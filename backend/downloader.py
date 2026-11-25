import os
import re
import subprocess
from urllib.parse import urlparse, parse_qs
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import numpy as np
import yt_dlp
from yt_dlp.utils import download_range_func
from backend.config import TEMP_DIR, UPLOADS_DIR, FFMPEG_PATH
from backend.demo_datasets import get_demo_info


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

    def get_video_info(self, url: str) -> Dict[str, Any]:
        """Fetches real metadata without downloading the full video."""
        clean_url = url.strip()
        if clean_url.startswith("demo://") or clean_url in ("demo", "sample"):
            return get_demo_info(clean_url)

        if clean_url.startswith("local://"):
            return self._get_local_video_info(clean_url)

        if clean_url in self._info_cache:
            return self._info_cache[clean_url]

        # Try default yt-dlp web/ios first, then alternative clients
        client_profiles: List[Optional[Dict[str, Any]]] = [
            None,
            {'youtube': {'player_client': ['tv', 'web']}},
            {'youtube': {'player_client': ['android', 'web_creator']}},
        ]

        last_err = None
        for profile in client_profiles:
            ydl_opts: Dict[str, Any] = {
                'skip_download': True,
                'quiet': True,
                'no_warnings': True,
                'socket_timeout': 15,
            }
            if profile:
                ydl_opts['extractor_args'] = profile

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
                        "subtitles": list((info.get("subtitles") or {}).keys()) + list((info.get("automatic_captions") or {}).keys()),
                        "is_demo": False,
                        "is_local": False,
                    }
                    self._info_cache[clean_url] = data
                    return data
            except Exception as e:
                last_err = e
                continue

        raise RuntimeError(f"Unable to read YouTube video metadata: {last_err}")

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

        # Generate real poster frame thumbnail from uploaded video
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
    ) -> Path:
        """
        Extracts [start_sec, end_sec] with BOTH video + audio accurately.
        Supports: local uploaded files, YouTube (dual-stream range seek -> download_ranges -> local cache), and studio demo mode.
        """
        out_path = self.output_dir / output_filename
        if out_path.exists() and out_path.stat().st_size > 10000:
            return out_path

        clean_url = url.strip()
        duration = max(1.0, float(end_sec) - float(start_sec))

        if clean_url.startswith("demo://") or clean_url in ("demo", "sample"):
            return self._generate_synthetic_video(start_sec, end_sec, out_path, "Studio Demo Preview")

        if clean_url.startswith("local://"):
            filename = clean_url.replace("local://", "", 1).strip()
            src_path = (UPLOADS_DIR / filename).resolve()
            if not src_path.exists():
                raise FileNotFoundError(f"Uploaded source video not found: {filename}")
            self._cut_local_file(src_path, start_sec, duration, out_path)
            return out_path

        video_id = self.extract_video_id(clean_url) or "yt"

        # 0. Fast-path: check if source video was already cached locally
        cached_src = self.output_dir / f"src_{video_id}.mp4"
        if cached_src.exists() and cached_src.stat().st_size > 50000:
            self._cut_local_file(cached_src, start_sec, duration, out_path)
            if out_path.exists() and out_path.stat().st_size > 10000:
                return out_path

        # 1. Strategy A: Direct dual-stream FFmpeg HTTP range seek (fastest for long podcasts!)
        if self._try_direct_ffmpeg_cut(clean_url, start_sec, duration, out_path):
            return out_path

        # 2. Strategy B: yt-dlp native download_ranges (handles signatures/HLS/manifests)
        if self._try_ytdlp_range_download(clean_url, start_sec, end_sec, out_path):
            return out_path

        # 3. Strategy C: Download <=720p MP4 once to cache, then slice locally (100% reliable)
        if self._download_cached_source(clean_url, cached_src):
            self._cut_local_file(cached_src, start_sec, duration, out_path)
            if out_path.exists() and out_path.stat().st_size > 10000:
                return out_path

        raise RuntimeError(
            "Failed to stream or download video clip from YouTube. "
            "YouTube may have blocked/rate-limited this video, or it is private/restricted. "
            "Try another public link or upload an MP4 video directly."
        )

    def _cut_local_file(self, src_path: Path, start_sec: float, duration: float, out_path: Path) -> None:
        cmd = [
            FFMPEG_PATH, "-y",
            "-ss", f"{max(0.0, start_sec):.3f}",
            "-t", f"{duration:.3f}",
            "-i", str(src_path),
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            str(out_path),
        ]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0 or not out_path.exists() or out_path.stat().st_size < 5000:
            raise RuntimeError(f"Failed to cut segment from local file: {proc.stderr[-300:] if proc.stderr else 'unknown error'}")

    def _pick_streams(self, info: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Dict[str, str]]:
        headers = info.get("http_headers") or {}
        formats = info.get("formats") or []

        # Check muxed MP4 <= 720p first
        muxed = [
            f for f in formats
            if f.get("url") and f.get("vcodec") not in (None, "none") and f.get("acodec") not in (None, "none")
        ]
        if muxed:
            mp4_muxed = [f for f in muxed if f.get("ext") == "mp4" and (f.get("height") or 0) <= 720]
            chosen = mp4_muxed[-1] if mp4_muxed else muxed[-1]
            return chosen["url"], None, chosen.get("http_headers") or headers

        # Otherwise pick separate video (prefer h264/avc1 <= 720p for rapid seeking/decode) + best audio
        vid_cands = [
            f for f in formats
            if f.get("url") and f.get("vcodec") not in (None, "none") and f.get("acodec") in (None, "none")
            and (f.get("height") or 0) <= 720
            and not str(f.get("protocol", "")).startswith("m3u8")
        ]
        # Prefer h264 over av1/vp9 for encoding speed
        h264_cands = [f for f in vid_cands if "avc" in str(f.get("vcodec", "")).lower()]
        v_list = h264_cands or vid_cands
        if not v_list:
            # Allow m3u8/anything <=720p
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

    def _try_direct_ffmpeg_cut(self, url: str, start_sec: float, duration: float, out_path: Path) -> bool:
        try:
            with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True, 'skip_download': True, 'socket_timeout': 15}) as ydl:
                info = ydl.extract_info(url, download=False)
            v_url, a_url, headers = self._pick_streams(info)
            if not v_url:
                return False

            header_str = "".join(f"{k}: {v}\r\n" for k, v in headers.items() if k.lower() in ("user-agent", "referer", "origin"))
            common_in = ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"]
            if header_str:
                common_in = ["-headers", header_str] + common_in

            cmd = [FFMPEG_PATH, "-y"] + common_in + ["-ss", f"{max(0.0, start_sec):.3f}", "-t", f"{duration:.3f}", "-i", v_url]
            if a_url:
                cmd += common_in + ["-ss", f"{max(0.0, start_sec):.3f}", "-t", f"{duration:.3f}", "-i", a_url]
                cmd += ["-map", "0:v:0", "-map", "1:a:0"]
            else:
                cmd += ["-map", "0:v:0", "-map", "0:a?"]

            cmd += [
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k",
                "-shortest",
                str(out_path),
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=max(60, int(duration * 3)))
            if proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 10000:
                return True
            out_path.unlink(missing_ok=True)
        except Exception:
            out_path.unlink(missing_ok=True)
        return False

    def _try_ytdlp_range_download(self, url: str, start_sec: float, end_sec: float, out_path: Path) -> bool:
        try:
            stem_tmpl = str(out_path.with_suffix(""))
            ydl_opts = {
                'format': 'bestvideo[height<=720][vcodec^=avc1]+bestaudio/bestvideo[height<=720]+bestaudio/best[height<=720]/best',
                'ffmpeg_location': FFMPEG_PATH,
                'download_ranges': download_range_func(None, [(max(0.0, start_sec), end_sec)]),
                'force_keyframes_at_cuts': True,
                'merge_output_format': 'mp4',
                'outtmpl': f"{stem_tmpl}.%(ext)s",
                'quiet': True,
                'no_warnings': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])

            if out_path.exists() and out_path.stat().st_size > 10000:
                return True
            # Check alternative extension written by yt-dlp
            for alt in out_path.parent.glob(f"{out_path.stem}.*"):
                if alt.stat().st_size > 10000:
                    alt.replace(out_path)
                    return True
        except Exception:
            out_path.unlink(missing_ok=True)
        return False

    def _download_cached_source(self, url: str, cached_src: Path) -> bool:
        try:
            ydl_opts = {
                'format': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best',
                'ffmpeg_location': FFMPEG_PATH,
                'merge_output_format': 'mp4',
                'outtmpl': str(cached_src),
                'quiet': True,
                'no_warnings': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            return cached_src.exists() and cached_src.stat().st_size > 50000
        except Exception:
            cached_src.unlink(missing_ok=True)
            return False

    def _generate_synthetic_video(self, start_sec: float, end_sec: float, dest: Path, label: str) -> Path:
        """
        Generates a clean animated studio demo video with soft harmonic audio
        for offline demos & tests (never blank flat gray + jarring beep).
        """
        duration = max(1.0, float(end_sec) - float(start_sec))
        vf = (
            "drawgrid=w=80:h=80:t=1:c=0x1e293b@0.45,"
            "drawbox=x=0:y=320:w=1280:h=80:color=0x4f46e5@0.12:t=fill"
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
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return dest

    @staticmethod
    def extract_waveform_peaks(media_path: Path, num_bars: int = 48) -> List[int]:
        """Extracts real audio RMS amplitude percentages (15..100) from any video/audio file."""
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
            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
            chunks = np.array_split(np.abs(samples), num_bars)
            rms = np.array([float(np.sqrt(np.mean(c ** 2))) if len(c) else 0.0 for c in chunks])
            max_val = float(np.max(rms)) if np.max(rms) > 1e-6 else 1.0
            return [int(max(14, min(100, (v / max_val) * 92 + 8))) for v in rms]
        except Exception:
            return [35] * num_bars
