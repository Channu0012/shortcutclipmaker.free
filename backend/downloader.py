import json
import re
import shutil
import subprocess
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, quote, urlparse

try:
    import numpy as np
except ImportError:
    np = None

import yt_dlp
from yt_dlp.utils import download_range_func

from backend.config import BASE_DIR, COOKIES_PATH, FFMPEG_PATH, IS_VERCEL, TEMP_DIR, UPLOADS_DIR, YTDLP_PROXY

PLAYER_CLIENT_PROFILES: List[Optional[Dict[str, Any]]] = [
    {"youtube": {"player_client": ["tv_embedded"]}},
    {"youtube": {"player_client": ["android_vr"]}},
    {"youtube": {"player_client": ["ios"]}},
    {"youtube": {"player_client": ["tv", "web"]}},
    {"youtube": {"player_client": ["mweb"]}},
    None,
]


def build_ytdlp_opts(
    base_opts: Optional[Dict[str, Any]] = None,
    client_profile: Optional[Dict[str, Any]] = None,
    cookie_file: Optional[Path] = None,
) -> Dict[str, Any]:
    """Builds consistent yt-dlp options with optional per-request cookiefile, proxy, and player client args."""
    opts: Dict[str, Any] = dict(base_opts or {})
    if client_profile:
        opts["extractor_args"] = client_profile
    active_cookie = cookie_file if (cookie_file and cookie_file.exists() and cookie_file.stat().st_size > 20) else None
    if not active_cookie and COOKIES_PATH.exists() and COOKIES_PATH.stat().st_size > 20:
        active_cookie = COOKIES_PATH
    if active_cookie:
        opts["cookiefile"] = str(active_cookie)
    if YTDLP_PROXY:
        opts["proxy"] = YTDLP_PROXY
    return opts


class VideoDownloader:
    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or TEMP_DIR
        self._info_cache: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        if not url:
            return None
        s = url.strip()
        if not s.startswith(("http://", "https://")) and ("youtube." in s or "youtu.be" in s):
            s = "https://" + s
        try:
            parsed = urlparse(s)
            host = (parsed.netloc or "").lower()
            path_parts = [p for p in parsed.path.split("/") if p]
            if "youtu.be" in host and path_parts:
                vid = path_parts[0]
                return vid if re.fullmatch(r"[0-9A-Za-z_-]{11}", vid) else None
            if "youtube" in host:
                qs = parse_qs(parsed.query)
                if "v" in qs and qs["v"]:
                    vid = qs["v"][0]
                    return vid if re.fullmatch(r"[0-9A-Za-z_-]{11}", vid) else None
                for prefix in ("shorts", "live", "embed", "v"):
                    if len(path_parts) >= 2 and path_parts[0] == prefix:
                        vid = path_parts[1]
                        return vid if re.fullmatch(r"[0-9A-Za-z_-]{11}", vid) else None
        except Exception:
            pass
        return None

    @staticmethod
    def is_valid_youtube_url(url: str) -> bool:
        if not url:
            return False
        clean = url.strip()
        if clean.startswith(("demo://", "local://")) or clean in ("demo", "sample"):
            return True
        return VideoDownloader.extract_video_id(clean) is not None

    @staticmethod
    def _has_cookies(cookie_file: Optional[Path]) -> bool:
        if cookie_file and cookie_file.exists() and cookie_file.stat().st_size > 20:
            return True
        return COOKIES_PATH.exists() and COOKIES_PATH.stat().st_size > 20

    @staticmethod
    def _classify_ytdlp_error(raw_err: str) -> str:
        low = (raw_err or "").lower()
        if "members-only" in low or "join this channel" in low or "subscriber_only" in low:
            return (
                "This YouTube video is members-only (requires channel membership). "
                "Paste signed-in member cookies in Studio Settings, upload the MP4 directly, or test with Instant Demo."
            )
        if "private video" in low:
            return "This YouTube video is private. Only public or authorized cookie-backed videos can be clipped."
        if "confirm your age" in low or "age-restricted" in low:
            return "This YouTube video is age-restricted. Paste signed-in YouTube cookies in Studio Settings or upload the MP4 directly."
        if "bot" in low or "sign in" in low or "cookies" in low:
            return (
                "YouTube blocked automated server downloads from this cloud IP. "
                "Upload your MP4 file directly (cuts offline in-browser for any size), paste YouTube cookies in Settings, or use a Local Engine."
            )
        if "video unavailable" in low or "not available" in low or "removed" in low:
            return "This YouTube video is unavailable, deleted, or region-restricted."
        clean_err = re.sub(r"ERROR:\s*\[[^\]]+\]\s*[\w-]+:\s*", "", (raw_err or "").strip())
        clean_err = clean_err.split("|")[-1].strip()[:140]
        if clean_err:
            return f"Could not fetch this video stream from YouTube ({clean_err}). Upload the MP4 directly or test with Instant Demo."
        return "Could not fetch this video stream from YouTube. Try uploading the MP4 directly or testing with Instant Demo."

    def get_video_info(self, url: str, cookie_file: Optional[Path] = None) -> Dict[str, Any]:
        """Fetches real metadata without downloading the full video."""
        clean_url = url.strip()
        if clean_url.startswith("demo://") or clean_url in ("demo", "sample"):
            return get_demo_info_safe(clean_url)

        if clean_url.startswith("local://"):
            return self._get_local_video_info(clean_url)

        has_cookies = self._has_cookies(cookie_file)
        if clean_url in self._info_cache and not has_cookies:
            return self._info_cache[clean_url]

        last_err = None
        profiles = PLAYER_CLIENT_PROFILES[:2] if (IS_VERCEL and not has_cookies) else PLAYER_CLIENT_PROFILES
        sock_timeout = 5 if IS_VERCEL else 15

        for profile in profiles:
            ydl_opts = build_ytdlp_opts(
                {
                    "skip_download": True,
                    "quiet": True,
                    "no_warnings": True,
                    "socket_timeout": sock_timeout,
                },
                profile,
                cookie_file=cookie_file,
            )
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(clean_url, download=False)
                    if not info:
                        continue
                    data = {
                        "id": info.get("id") or self.extract_video_id(clean_url) or "yt_video",
                        "title": info.get("title") or "Untitled YouTube Video",
                        "duration": int(info.get("duration") or 0),
                        "channel": info.get("uploader") or info.get("channel") or "YouTube Creator",
                        "thumbnail": info.get("thumbnail") or "",
                        "subtitles": list((info.get("subtitles") or {}).keys())
                        + list((info.get("automatic_captions") or {}).keys()),
                        "is_demo": False,
                        "is_local": False,
                    }
                    self._info_cache[clean_url] = data
                    return data
            except Exception as exc:
                last_err = exc
                continue

        err_low = str(last_err or "").lower()
        if any(k in err_low for k in ("members-only", "join this channel", "private video", "video unavailable")):
            raise PermissionError(self._classify_ytdlp_error(str(last_err)))

        fallback_data = self._fetch_oembed_fallback(clean_url)
        if fallback_data:
            self._info_cache[clean_url] = fallback_data
            return fallback_data

        raise RuntimeError(self._classify_ytdlp_error(str(last_err or "Unable to read YouTube video metadata")))

    def _fetch_oembed_fallback(self, url: str) -> Optional[Dict[str, Any]]:
        vid = self.extract_video_id(url)
        if not vid:
            return None
        canonical = f"https://www.youtube.com/watch?v={vid}"
        title = None
        author = None
        thumb = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
        duration = 0

        try:
            oembed_url = f"https://www.youtube.com/oembed?url={quote(canonical, safe='')}&format=json"
            req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                title = data.get("title")
                author = data.get("author_name")
                thumb = data.get("thumbnail_url") or thumb
        except Exception:
            pass

        try:
            req_html = urllib.request.Request(
                canonical,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            )
            with urllib.request.urlopen(req_html, timeout=8) as resp:
                page = resp.read().decode("utf-8", errors="ignore")
                m_dur = re.search(r'"lengthSeconds"\s*:\s*"(\d+)"', page)
                if m_dur:
                    duration = int(m_dur.group(1))
                else:
                    m_iso = re.search(r'<meta[^>]+itemprop="duration"[^>]+content="PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"', page, re.IGNORECASE)
                    if m_iso:
                        h, m, s = (int(x or 0) for x in m_iso.groups())
                        duration = h * 3600 + m * 60 + s
                if not title:
                    m_title = re.search(r"<title>(.*?)</title>", page, re.IGNORECASE | re.DOTALL)
                    if m_title:
                        title = re.sub(r"\s*-\s*YouTube\s*$", "", m_title.group(1)).strip()
        except Exception:
            pass

        if not title and duration <= 0:
            return None

        return {
            "id": vid,
            "title": title or f"YouTube Video ({vid})",
            "duration": duration if duration > 0 else 360,
            "channel": author or "YouTube Creator",
            "thumbnail": thumb,
            "subtitles": ["en"],
            "is_demo": False,
            "is_local": False,
        }

    def _get_local_video_info(self, url: str) -> Dict[str, Any]:
        filename = url.replace("local://", "", 1).strip()
        file_path = (UPLOADS_DIR / filename).resolve()
        if not file_path.exists():
            raise FileNotFoundError(f"Uploaded video not found: {filename}")

        probe = subprocess.run([FFMPEG_PATH, "-i", str(file_path)], capture_output=True, text=True)
        dur = 0
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", probe.stderr or "")
        if m:
            dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(float(m.group(3)))

        thumb_name = f"thumb_{file_path.stem}.jpg"
        thumb_path = TEMP_DIR / thumb_name
        if not thumb_path.exists():
            seek_at = min(5.0, max(0.0, dur * 0.1))
            subprocess.run(
                [FFMPEG_PATH, "-y", "-ss", str(seek_at), "-i", str(file_path), "-vframes", "1", "-q:v", "3", str(thumb_path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

        return {
            "id": f"local_{file_path.stem}",
            "title": file_path.stem.replace("_", " ").replace("-", " ").title(),
            "duration": max(1, dur),
            "channel": "Local Studio Upload",
            "thumbnail": f"/api/assets/thumb/{thumb_name}" if thumb_path.exists() else "",
            "subtitles": [],
            "is_demo": False,
            "is_local": True,
            "local_path": str(file_path),
        }

    def download_segment(
        self,
        url: str,
        start_sec: float,
        end_sec: float,
        output_filename: str,
        cookie_file: Optional[Path] = None,
    ) -> Path:
        """
        Extracts [start_sec, end_sec] with BOTH video + audio accurately.
        """
        out_path = self.output_dir / output_filename
        if out_path.exists() and out_path.stat().st_size > 10000:
            return out_path

        clean_url = url.strip()
        start_clamped = max(0.0, float(start_sec))
        duration = max(1.0, float(end_sec) - start_clamped)

        if clean_url.startswith("demo://") or clean_url in ("demo", "sample"):
            return self._generate_synthetic_video(start_clamped, start_clamped + duration, out_path, "Klipnux Demo")

        if clean_url.startswith("local://"):
            filename = clean_url.replace("local://", "", 1).strip()
            src_path = (UPLOADS_DIR / filename).resolve()
            if not src_path.exists():
                raise FileNotFoundError(f"Uploaded source video not found: {filename}")
            self._cut_local_file(src_path, start_clamped, duration, out_path)
            return out_path

        video_id = self.extract_video_id(clean_url) or "yt"

        cached_src = self.output_dir / f"src_{video_id}.mp4"
        if cached_src.exists() and cached_src.stat().st_size > 50000:
            self._cut_local_file(cached_src, start_clamped, duration, out_path)
            if out_path.exists() and out_path.stat().st_size > 10000:
                return out_path

        errors: List[str] = []

        ok, err_msg = self._try_ytdlp_range_download(
            clean_url, start_clamped, start_clamped + duration, out_path, cookie_file=cookie_file
        )
        if ok:
            return out_path
        if err_msg:
            errors.append(err_msg)

        ok, err_msg = self._try_direct_ffmpeg_cut(clean_url, start_clamped, duration, out_path, cookie_file=cookie_file)
        if ok:
            return out_path
        if err_msg:
            errors.append(err_msg)

        if not IS_VERCEL:
            ok, err_msg = self._download_cached_source(clean_url, cached_src, cookie_file=cookie_file)
            if ok:
                self._cut_local_file(cached_src, start_clamped, duration, out_path)
                if out_path.exists() and out_path.stat().st_size > 10000:
                    return out_path
            if err_msg:
                errors.append(err_msg)

        joined = " | ".join(errors)
        raise RuntimeError(self._classify_ytdlp_error(joined))

    def _cut_local_file(self, src_path: Path, start_sec: float, duration: float, out_path: Path) -> None:
        cmd = [
            FFMPEG_PATH, "-y",
            "-ss", f"{max(0.0, start_sec):.3f}",
            "-t", f"{duration:.3f}",
            "-i", str(src_path),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(out_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0 or not out_path.exists() or out_path.stat().st_size < 5000:
            raise RuntimeError(f"Failed to cut segment from local file: {proc.stderr[-300:] if proc.stderr else 'unknown error'}")

    def _pick_streams(self, info: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Dict[str, str]]:
        headers = info.get("http_headers") or {}
        formats = info.get("formats") or []

        muxed = [
            f for f in formats
            if f.get("url") and f.get("vcodec") not in (None, "none") and f.get("acodec") not in (None, "none")
        ]
        if muxed:
            mp4_muxed = [f for f in muxed if f.get("ext") == "mp4" and (f.get("height") or 0) <= 720]
            chosen = mp4_muxed[-1] if mp4_muxed else muxed[-1]
            return chosen["url"], None, chosen.get("http_headers") or headers

        vid_cands = [
            f for f in formats
            if f.get("url") and f.get("vcodec") not in (None, "none") and f.get("acodec") in (None, "none")
            and (f.get("height") or 0) <= 720
            and not str(f.get("protocol", "")).startswith("m3u8")
        ]
        h264_cands = [f for f in vid_cands if "avc" in str(f.get("vcodec", "")).lower()]
        v_list = h264_cands or vid_cands
        if not v_list:
            v_list = [f for f in formats if f.get("url") and f.get("vcodec") not in (None, "none") and (f.get("height") or 0) <= 720]

        aud_cands = [
            f for f in formats
            if f.get("url") and f.get("acodec") not in (None, "none") and f.get("vcodec") in (None, "none")
        ]
        m4a_aud = [f for f in aud_cands if f.get("ext") == "m4a"]
        a_list = m4a_aud or aud_cands

        if v_list and a_list:
            v_list.sort(key=lambda f: f.get("height") or 0)
            a_list.sort(key=lambda f: f.get("abr") or 0)
            v_fmt = v_list[-1]
            a_fmt = a_list[-1]
            return v_fmt["url"], a_fmt["url"], v_fmt.get("http_headers") or headers

        return None, None, headers

    def _try_direct_ffmpeg_cut(
        self, url: str, start_sec: float, duration: float, out_path: Path, cookie_file: Optional[Path] = None
    ) -> Tuple[bool, Optional[str]]:
        last_err: Optional[str] = None
        has_cookies = self._has_cookies(cookie_file)
        profiles = PLAYER_CLIENT_PROFILES[:1] if (IS_VERCEL and not has_cookies) else PLAYER_CLIENT_PROFILES[:4]
        sock_timeout = 5 if IS_VERCEL else 12
        for profile in profiles:
            try:
                opts = build_ytdlp_opts(
                    {"quiet": True, "no_warnings": True, "skip_download": True, "socket_timeout": sock_timeout},
                    profile,
                    cookie_file=cookie_file,
                )
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                v_url, a_url, headers = self._pick_streams(info)
                if not v_url:
                    continue

                header_str = "".join(
                    f"{k}: {v}\r\n" for k, v in headers.items() if k.lower() in ("user-agent", "referer", "origin", "accept", "accept-language")
                )
                common_in = ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "4"]
                if header_str:
                    common_in = ["-headers", header_str] + common_in

                cmd = [FFMPEG_PATH, "-y"] + common_in + ["-ss", f"{max(0.0, start_sec):.3f}", "-t", f"{duration:.3f}", "-i", v_url]
                if a_url:
                    cmd += common_in + ["-ss", f"{max(0.0, start_sec):.3f}", "-t", f"{duration:.3f}", "-i", a_url]
                    cmd += ["-map", "0:v:0", "-map", "1:a:0"]
                else:
                    cmd += ["-map", "0:v:0", "-map", "0:a?"]

                cmd += [
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k",
                    "-shortest",
                    str(out_path),
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=max(45, int(duration * 2.5)))
                if proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 10000:
                    return True, None
                out_path.unlink(missing_ok=True)
            except Exception as exc:
                last_err = str(exc)
                out_path.unlink(missing_ok=True)
        return False, last_err

    def _try_ytdlp_range_download(
        self, url: str, start_sec: float, end_sec: float, out_path: Path, cookie_file: Optional[Path] = None
    ) -> Tuple[bool, Optional[str]]:
        last_err: Optional[str] = None
        stem_tmpl = str(out_path.with_suffix(""))
        has_cookies = self._has_cookies(cookie_file)
        profiles = PLAYER_CLIENT_PROFILES[:2] if (IS_VERCEL and not has_cookies) else PLAYER_CLIENT_PROFILES
        sock_timeout = 6 if IS_VERCEL else 15
        fmt_expr = (
            "best[height<=480][ext=mp4]/bestvideo[height<=480][vcodec^=avc1]+bestaudio/best[height<=480]/best"
            if IS_VERCEL
            else "bestvideo[height<=720][vcodec^=avc1]+bestaudio/bestvideo[height<=720]+bestaudio/best[height<=720]/best"
        )
        for profile in profiles:
            try:
                ydl_opts = build_ytdlp_opts(
                    {
                        "format": fmt_expr,
                        "ffmpeg_location": FFMPEG_PATH,
                        "download_ranges": download_range_func(None, [(max(0.0, start_sec), end_sec)]),
                        "force_keyframes_at_cuts": not IS_VERCEL,
                        "concurrent_fragment_downloads": 4,
                        "merge_output_format": "mp4",
                        "outtmpl": f"{stem_tmpl}.%(ext)s",
                        "quiet": True,
                        "no_warnings": True,
                        "socket_timeout": sock_timeout,
                    },
                    profile,
                    cookie_file=cookie_file,
                )
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])

                if out_path.exists() and out_path.stat().st_size > 10000:
                    return True, None
                for alt in out_path.parent.glob(f"{out_path.stem}.*"):
                    if alt.stat().st_size > 10000:
                        alt.replace(out_path)
                        return True, None
            except Exception as exc:
                last_err = str(exc)
                for leftover in out_path.parent.glob(f"{out_path.stem}.*"):
                    leftover.unlink(missing_ok=True)
        return False, last_err

    def _download_cached_source(
        self, url: str, cached_src: Path, cookie_file: Optional[Path] = None
    ) -> Tuple[bool, Optional[str]]:
        last_err: Optional[str] = None
        for profile in PLAYER_CLIENT_PROFILES[:4]:
            try:
                ydl_opts = build_ytdlp_opts(
                    {
                        "format": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best",
                        "ffmpeg_location": FFMPEG_PATH,
                        "merge_output_format": "mp4",
                        "outtmpl": str(cached_src),
                        "quiet": True,
                        "no_warnings": True,
                        "socket_timeout": 15,
                    },
                    profile,
                    cookie_file=cookie_file,
                )
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])
                if cached_src.exists() and cached_src.stat().st_size > 50000:
                    return True, None
            except Exception as exc:
                last_err = str(exc)
                cached_src.unlink(missing_ok=True)
        return False, last_err

    def _generate_synthetic_video(self, start_sec: float, end_sec: float, dest: Path, label: str) -> Path:
        duration = max(1.0, float(end_sec) - float(start_sec))
        vf = (
            "drawgrid=w=80:h=80:t=1:c=0x1e293b@0.45,"
            "drawbox=x=0:y=320:w=1280:h=80:color=0x6f2cf3@0.14:t=fill"
        )
        cmd = [
            FFMPEG_PATH, "-y",
            "-f", "lavfi", "-i", f"color=c=0x0b0f1c:s=1280x720:d={duration}:r=30",
            "-f", "lavfi", "-i", f"aevalsrc=0.03*sin(2*PI*220*t)+0.02*sin(2*PI*330*t):d={duration}:s=44100",
            "-vf", vf,
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k",
            str(dest),
        ]
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            return dest
        except Exception:
            fallback_candidates = [
                BASE_DIR / "public" / "assets" / "sample_preview.mp4",
                BASE_DIR / "frontend" / "dist" / "sample_preview.mp4",
            ]
            for cand in fallback_candidates:
                if cand.exists() and cand.stat().st_size > 10000:
                    shutil.copyfile(cand, dest)
                    return dest
            raise

    @staticmethod
    def extract_waveform_peaks(media_path: Path, num_bars: int = 48) -> List[int]:
        if not media_path.exists():
            return [32] * num_bars
        cmd = [
            FFMPEG_PATH, "-v", "error",
            "-i", str(media_path),
            "-ac", "1", "-ar", "4000",
            "-f", "s16le", "-",
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=15)
            raw = proc.stdout
            if not raw or len(raw) < num_bars * 4:
                return [35] * num_bars
            num_samples = len(raw) // 2
            if np is not None:
                samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
                chunks = np.array_split(np.abs(samples), num_bars)
                rms = np.array([float(np.sqrt(np.mean(c ** 2))) if len(c) else 0.0 for c in chunks])
                max_val = float(np.max(rms)) if np.max(rms) > 1e-6 else 1.0
                return [int(max(14, min(100, (v / max_val) * 92 + 8))) for v in rms]
            else:
                import math
                import struct
                samples = struct.unpack(f"<{num_samples}h", raw[:num_samples * 2])
                chunk_size = max(1, num_samples // num_bars)
                rms_vals = []
                for i in range(num_bars):
                    c = samples[i * chunk_size : (i + 1) * chunk_size]
                    if c:
                        sq_sum = sum(s * s for s in c)
                        rms_vals.append(math.sqrt(sq_sum / len(c)))
                    else:
                        rms_vals.append(0.0)
                max_val = max(rms_vals) if rms_vals and max(rms_vals) > 1e-6 else 1.0
                return [int(max(14, min(100, (v / max_val) * 92 + 8))) for v in rms_vals]
        except Exception:
            return [35] * num_bars


def get_demo_info_safe(clean_url: str) -> Dict[str, Any]:
    from backend.demo_datasets import get_demo_info
    return get_demo_info(clean_url)
