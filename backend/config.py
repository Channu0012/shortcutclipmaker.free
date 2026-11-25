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

OUTPUT_DIR = BASE_DIR / "storage" / "clips"
TEMP_DIR = BASE_DIR / "storage" / "temp"
UPLOADS_DIR = BASE_DIR / "storage" / "uploads"
FONTS_DIR = BASE_DIR / "backend" / "fonts"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
FONTS_DIR.mkdir(parents=True, exist_ok=True)

# FFmpeg binary
try:
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG_PATH = "ffmpeg"

# Configuration parameters
MAX_VIDEO_DURATION_MINUTES = 180
DEFAULT_TARGET_CLIP_SECONDS = 45
MIN_CLIP_SECONDS = 10
MAX_CLIP_SECONDS = 360

# API Keys & Services (optional overrides from .env or UI settings)
USER_API_KEY = os.getenv("USER_API_KEY", os.getenv("API_KEY", "94981c070f66fc789321d87774f7e89f"))
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", USER_API_KEY)
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", USER_API_KEY)
