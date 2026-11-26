import os
import re
from pathlib import Path
import imageio_ffmpeg

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(env_path: Path) -> None:
    """Lightweight .env loader so settings in .env apply even when run directly."""
    if not env_path.exists():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    except Exception:
        pass


_load_dotenv(BASE_DIR / ".env")

IS_VERCEL = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
if IS_VERCEL:
    STORAGE_BASE = Path("/tmp") / "storage"
else:
    STORAGE_BASE = BASE_DIR / "storage"

OUTPUT_DIR = STORAGE_BASE / "clips"
TEMP_DIR = STORAGE_BASE / "temp"
UPLOADS_DIR = STORAGE_BASE / "uploads"
FONTS_DIR = BASE_DIR / "backend" / "fonts"

for p in (OUTPUT_DIR, TEMP_DIR, UPLOADS_DIR):
    try:
        p.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

try:
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

# FFmpeg binary
try:
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG_PATH = os.getenv("IMAGEIO_FFMPEG_EXE", "ffmpeg")

# Configuration parameters
MAX_VIDEO_DURATION_MINUTES = 180
DEFAULT_TARGET_CLIP_SECONDS = 45
MIN_CLIP_SECONDS = 10
MAX_CLIP_SECONDS = 360

# API Keys & Services (optional overrides from .env or UI settings)
USER_API_KEY = os.getenv("USER_API_KEY", os.getenv("API_KEY", "94981c070f66fc789321d87774f7e89f"))
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", USER_API_KEY)
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", USER_API_KEY)
