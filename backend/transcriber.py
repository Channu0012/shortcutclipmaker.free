import html
import json
import re
import subprocess
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi

from backend.config import COOKIES_PATH, FFMPEG_PATH, IS_VERCEL, TEMP_DIR, UPLOADS_DIR, YTDLP_PROXY
from backend.demo_datasets import get_demo_transcript
from backend.downloader import PLAYER_CLIENT_PROFILES, VideoDownloader, build_ytdlp_opts


class VideoTranscriber:
    """
    Production multi-tier transcription engine with in-memory & disk caching.
    """

    def __init__(self, temp_dir: Optional[Path] = None):
        self.temp_dir = temp_dir or TEMP_DIR
        self._whisper_model = None
        self._transcript_cache: Dict[str, List[Dict[str, Any]]] = {}

    def clear_cache(self) -> None:
        self._transcript_cache.clear()

    @staticmethod
    def _clean_caption_text(raw: str) -> str:
        text = html.unescape(raw or "")
        text = re.sub(r"\[(?:Music|Applause|Laughter|Cheering|Silence)\]", "", text, flags=re.IGNORECASE)
        text = re.sub(r">>\s*", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    @staticmethod
    def _build_linear_words(text: str, start: float, end: float) -> List[Dict[str, Any]]:
        raw_words = text.split()
        if not raw_words:
            return []
        dur = max(0.15, end - start)
        w_step = dur / len(raw_words)
        return [
            {
                "word": w,
                "start": round(start + idx * w_step, 2),
                "end": round(start + (idx + 1) * w_step, 2),
            }
            for idx, w in enumerate(raw_words)
        ]

    @staticmethod
    def _build_chapter_cue_segments(duration: float, title: str = "Featured Segment") -> List[Dict[str, Any]]:
        """Generates clean highlight-ready cue segments across timeline slices."""
        total = max(90.0, float(duration or 360.0))
        step = max(22.0, min(45.0, total / 12.0))
        segments: List[Dict[str, Any]] = []
        cursor = 4.0
        idx = 1
        safe_title = re.sub(r"[^\w\s-]", "", title or "Featured Moment").strip()
        while cursor < total - 6.0 and idx <= 20:
            seg_end = min(total, cursor + step)
            phrase = f"Highlight #{idx}: {safe_title[:42]}"
            segments.append({
                "start": round(cursor, 2),
                "end": round(seg_end, 2),
                "text": phrase,
                "words": VideoTranscriber._build_linear_words(phrase, cursor, seg_end),
            })
            cursor = seg_end + 1.0
            idx += 1
        return segments

    def get_transcript(
        self,
        url: str,
        progress_cb: Optional[Callable[[str], None]] = None,
        cookie_file: Optional[Path] = None,
        video_info: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        s = (url or "").strip()

        if s in self._transcript_cache:
            return self._transcript_cache[s]

        if s.startswith("demo://") or s in ("demo", "sample"):
            segs = get_demo_transcript(s)
            self._transcript_cache[s] = segs
            return segs

        if s.startswith("local://"):
            filename = s.split("local://", 1)[1].strip("/")
            cache_key = f"local_{Path(filename).stem}"
            disk_cache = self.temp_dir / f"transcript_{cache_key}.json"
            if disk_cache.exists():
                try:
                    cached = json.loads(disk_cache.read_text(encoding="utf-8"))
                    if cached:
                        self._transcript_cache[s] = cached
                        return cached
                except Exception:
                    pass
            local_path = UPLOADS_DIR / filename
            if not local_path.exists():
                raise FileNotFoundError(f"Uploaded video not found: {filename}")
            if progress_cb:
                progress_cb("Extracting speech from uploaded video...")
            segs = self._transcribe_local_media(local_path, cache_key)
            if not segs:
                info = video_info or VideoDownloader()._get_local_video_info(s)
                segs = self._build_chapter_cue_segments(info.get("duration", 120), info.get("title", "Uploaded Video"))
            self._save_cache(s, disk_cache, segs)
            return segs

        video_id = self._extract_video_id(s)
        if not video_id:
            raise ValueError("Invalid YouTube URL: unable to parse 11-character video ID.")

        disk_cache = self.temp_dir / f"transcript_{video_id}.json"
        if disk_cache.exists():
            try:
                cached = json.loads(disk_cache.read_text(encoding="utf-8"))
                if cached and len(cached) >= 3:
                    self._transcript_cache[s] = cached
                    return cached
            except Exception:
                pass

        # Tier 1: Fast YouTubeTranscriptApi
        if progress_cb:
            progress_cb("Fetching YouTube speech captions...")
        try:
            segments = self._extract_via_youtube_transcript_api(video_id, cookie_file=cookie_file)
            if segments and len(segments) >= 3:
                self._save_cache(s, disk_cache, segments)
                return segments
        except Exception:
            pass

        # Tier 2: yt-dlp JSON3 across player client profiles
        if progress_cb:
            progress_cb("Checking YouTube timed-text word captions...")
        try:
            segments = self._extract_via_ytdlp(s, cookie_file=cookie_file)
            if segments and len(segments) >= 3:
                self._save_cache(s, disk_cache, segments)
                return segments
        except Exception:
            pass

        # Tier 3: Local AI Whisper transcription
        if not IS_VERCEL:
            if progress_cb:
                progress_cb("Running Whisper AI speech-to-text...")
            try:
                segments = self._extract_via_whisper(s, video_id, cookie_file=cookie_file)
                if segments and len(segments) >= 3:
                    self._save_cache(s, disk_cache, segments)
                    return segments
            except ImportError:
                pass
            except Exception:
                pass

        # Tier 4: Timeline segmentation fallback using already-fetched metadata (no redundant API loop)
        try:
            info = video_info or VideoDownloader().get_video_info(s, cookie_file=cookie_file)
            cue_segs = self._build_chapter_cue_segments(
                info.get("duration", 360),
                info.get("title", "YouTube Highlight"),
            )
            if cue_segs:
                self._save_cache(s, disk_cache, cue_segs)
                return cue_segs
        except Exception as exc:
            raise RuntimeError(f"Could not extract speech or timeline metadata: {exc}")

        raise RuntimeError("Could not extract any usable segments from this YouTube video.")

    def _save_cache(self, url: str, disk_cache: Optional[Path], segments: List[Dict[str, Any]]) -> None:
        self._transcript_cache[url] = segments
        if disk_cache:
            try:
                disk_cache.write_text(json.dumps(segments, ensure_ascii=False), encoding="utf-8")
            except Exception:
                pass

    def _extract_via_ytdlp(self, url: str, cookie_file: Optional[Path] = None) -> Optional[List[Dict[str, Any]]]:
        has_cookies = bool(cookie_file and cookie_file.exists()) or (COOKIES_PATH.exists() and COOKIES_PATH.stat().st_size > 20)
        profiles = PLAYER_CLIENT_PROFILES[:1] if (IS_VERCEL and not has_cookies) else PLAYER_CLIENT_PROFILES[:4]
        sock_timeout = 5 if IS_VERCEL else 12
        for profile in profiles:
            ydl_opts = build_ytdlp_opts(
                {
                    "skip_download": True,
                    "writesubtitles": True,
                    "writeautomaticsub": True,
                    "subtitleslangs": ["all"],
                    "quiet": True,
                    "no_warnings": True,
                    "socket_timeout": sock_timeout,
                },
                profile,
                cookie_file=cookie_file,
            )
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                subs = info.get("subtitles") or {}
                auto = info.get("automatic_captions") or {}

                target_key = None
                for pref in ["en", "hi", "es", "fr", "de", "pt"]:
                    for k in subs:
                        if k.startswith(pref):
                            target_key = (subs, k)
                            break
                    if target_key:
                        break
                    for k in auto:
                        if k.startswith(pref):
                            target_key = (auto, k)
                            break
                    if target_key:
                        break

                if not target_key:
                    if subs:
                        target_key = (subs, next(iter(subs)))
                    elif auto:
                        target_key = (auto, next(iter(auto)))

                if not target_key:
                    continue

                sub_dict, lang_code = target_key
                formats = sub_dict[lang_code]
                fmt = next((f for f in formats if f.get("ext") == "json3"), formats[0])
                req = urllib.request.Request(
                    fmt["url"],
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                events = data.get("events", [])
                segments: List[Dict[str, Any]] = []

                for ev in events:
                    segs_raw = ev.get("segs")
                    if not segs_raw:
                        continue

                    ev_start = round(ev.get("tStartMs", 0) / 1000.0, 2)
                    ev_dur = round(ev.get("dDurationMs", 2500) / 1000.0, 2)
                    ev_end = round(ev_start + max(0.4, ev_dur), 2)

                    words: List[Dict[str, Any]] = []
                    full_parts: List[str] = []
                    has_offsets = any("tOffsetMs" in s for s in segs_raw)

                    if has_offsets:
                        raw_timed: List[tuple[str, float]] = []
                        for s in segs_raw:
                            tok = self._clean_caption_text(s.get("utf8", ""))
                            if not tok:
                                continue
                            offset_s = ev_start + round(s.get("tOffsetMs", 0) / 1000.0, 2)
                            pieces = tok.split()
                            for pi, p in enumerate(pieces):
                                raw_timed.append((p, round(offset_s + pi * 0.18, 2)))
                                full_parts.append(p)
                        for idx, (tok, w_st) in enumerate(raw_timed):
                            w_en = raw_timed[idx + 1][1] if idx + 1 < len(raw_timed) else max(w_st + 0.3, ev_end)
                            if w_en <= w_st:
                                w_en = round(w_st + 0.18, 2)
                            words.append({"word": tok, "start": w_st, "end": round(w_en, 2)})
                        full_text = " ".join(full_parts)
                    else:
                        full_text = self._clean_caption_text("".join(s.get("utf8", "") for s in segs_raw))
                        words = self._build_linear_words(full_text, ev_start, ev_end)

                    if not full_text:
                        continue

                    if segments and segments[-1]["end"] > ev_start:
                        segments[-1]["end"] = max(segments[-1]["start"] + 0.1, round(ev_start - 0.02, 2))

                    segments.append({
                        "start": ev_start,
                        "end": ev_end,
                        "text": full_text,
                        "words": words,
                    })

                if len(segments) >= 3:
                    return segments
            except Exception:
                continue
        return None

    def _extract_via_youtube_transcript_api(
        self, video_id: str, cookie_file: Optional[Path] = None
    ) -> Optional[List[Dict[str, Any]]]:
        import http.cookiejar
        import requests
        from youtube_transcript_api.proxies import GenericProxyConfig

        session = requests.Session()
        active_cookie = cookie_file if (cookie_file and cookie_file.exists() and cookie_file.stat().st_size > 20) else None
        if not active_cookie and COOKIES_PATH.exists() and COOKIES_PATH.stat().st_size > 20:
            active_cookie = COOKIES_PATH
        if active_cookie:
            try:
                jar = http.cookiejar.MozillaCookieJar(str(active_cookie))
                jar.load(ignore_discard=True, ignore_expires=True)
                session.cookies.update(jar)
            except Exception:
                pass

        proxy_cfg = GenericProxyConfig(https_url=YTDLP_PROXY, http_url=YTDLP_PROXY) if YTDLP_PROXY else None
        ytt = YouTubeTranscriptApi(proxy_config=proxy_cfg, http_client=session)
        transcripts_list = ytt.list(video_id)
        target = None
        try:
            target = transcripts_list.find_transcript(["en", "en-US", "en-IN", "hi", "es"])
        except Exception:
            for t in transcripts_list:
                target = t
                break

        if not target:
            return None

        items = target.fetch()
        segments: List[Dict[str, Any]] = []
        for it in items:
            raw_text = getattr(it, "text", None) or (it.get("text") if isinstance(it, dict) else "")
            text = self._clean_caption_text(raw_text)
            if not text:
                continue
            start_val = getattr(it, "start", None) if hasattr(it, "start") else it.get("start", 0.0)
            dur_val = getattr(it, "duration", None) if hasattr(it, "duration") else it.get("duration", 2.0)
            start = round(float(start_val or 0.0), 2)
            dur = round(float(dur_val or 2.0), 2)
            end = round(start + max(0.3, dur), 2)
            words = self._build_linear_words(text, start, end)
            segments.append({
                "start": start,
                "end": end,
                "text": text,
                "words": words,
            })

        return segments if len(segments) >= 3 else None

    def _extract_via_whisper(self, url: str, video_id: str, cookie_file: Optional[Path] = None) -> Optional[List[Dict[str, Any]]]:
        import faster_whisper  # noqa: F401

        audio_path = self.temp_dir / f"whisper_{video_id}.m4a"
        if not audio_path.exists():
            for profile in PLAYER_CLIENT_PROFILES[:3]:
                try:
                    ydl_opts = build_ytdlp_opts(
                        {
                            "format": "bestaudio[ext=m4a]/bestaudio/140/bestaudio",
                            "outtmpl": str(self.temp_dir / f"whisper_{video_id}.%(ext)s"),
                            "quiet": True,
                            "no_warnings": True,
                        },
                        profile,
                        cookie_file=cookie_file,
                    )
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.download([url])
                    break
                except Exception:
                    continue
            if not audio_path.exists():
                for cand in self.temp_dir.glob(f"whisper_{video_id}.*"):
                    if cand.suffix.lower() in (".m4a", ".mp3", ".webm", ".opus", ".wav"):
                        audio_path = cand
                        break

        if not audio_path.exists() or audio_path.stat().st_size < 1000:
            return None
        return self._run_whisper_file(audio_path)

    def _transcribe_local_media(self, video_path: Path, cache_key: str) -> Optional[List[Dict[str, Any]]]:
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            return None

        audio_path = self.temp_dir / f"audio_{cache_key}.wav"
        if not audio_path.exists():
            cmd = [
                FFMPEG_PATH, "-y",
                "-i", str(video_path),
                "-vn", "-ac", "1", "-ar", "16000",
                str(audio_path),
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0 or not audio_path.exists():
                return None
        return self._run_whisper_file(audio_path)

    def _run_whisper_file(self, audio_path: Path) -> Optional[List[Dict[str, Any]]]:
        from faster_whisper import WhisperModel

        if self._whisper_model is None:
            self._whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")

        segments_iter, _ = self._whisper_model.transcribe(
            str(audio_path),
            beam_size=1,
            word_timestamps=True,
        )

        segments: List[Dict[str, Any]] = []
        for seg in segments_iter:
            text = self._clean_caption_text(seg.text)
            if not text:
                continue
            words: List[Dict[str, Any]] = []
            if seg.words:
                for w in seg.words:
                    wt = w.word.strip()
                    if wt:
                        words.append({
                            "word": wt,
                            "start": round(w.start, 2),
                            "end": round(w.end, 2),
                        })
            if not words:
                words = self._build_linear_words(text, round(seg.start, 2), round(seg.end, 2))

            segments.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": text,
                "words": words,
            })

        return segments if len(segments) >= 1 else None

    @staticmethod
    def _extract_video_id(url: str) -> Optional[str]:
        return VideoDownloader.extract_video_id(url)
