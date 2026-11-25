# ShortCut - Autonomous Acceptance Gates

## G1: Backend Environment & FFmpeg Binary
Verify Python venv, imageio-ffmpeg binary path, and yt-dlp are functional.
CHECK: .\venv\Scripts\python.exe -c "import yt_dlp, imageio_ffmpeg; print('FFMPEG_READY:' + imageio_ffmpeg.get_ffmpeg_exe())"
EXPECT: FFMPEG_READY:

## G2: Video & Transcript Ingestion Module
Verify downloader and transcript parsing works with timestamps.
CHECK: .\venv\Scripts\python.exe -m pytest tests/test_ingestion.py -v
EXPECT: PASSED

## G3: AI Highlight & Hook Detector
Verify transcript analysis identifies hooks, scores virality, and creates 30s-120s segments.
CHECK: .\venv\Scripts\python.exe -m pytest tests/test_highlighter.py -v
EXPECT: PASSED

## G4: 9:16 Video Composition & Subtitle Styler
Verify FFmpeg engine creates a valid 9:16 vertical MP4 with subtitles and hook banner.
CHECK: .\venv\Scripts\python.exe -m pytest tests/test_video_processor.py -v
EXPECT: PASSED

## G5: FastAPI Server & REST Endpoints
Verify all API endpoints (/api/health, /api/analyze, /api/generate-clip, /api/clips/{id}) respond correctly.
CHECK: .\venv\Scripts\python.exe -m pytest tests/test_api.py -v
EXPECT: PASSED

## G6: Frontend Web Application Build & Assets
Verify frontend builds cleanly and exports production-ready web client.
CHECK: node scripts/verify-frontend.js
EXPECT: FRONTEND_VERIFIED_SUCCESS

## G7: End-to-End Video Generation & Download Validation
Verify full pipeline from URL/input to rendered downloadable MP4 file with valid dimensions and non-zero size.
CHECK: .\venv\Scripts\python.exe -m pytest tests/test_e2e.py -v
EXPECT: E2E_PIPELINE_SUCCESS
