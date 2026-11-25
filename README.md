# shortcutclipmaker.free

## ShortCut Studio Pro -- AI Long-Form Video to Viral Shorts Engine

Turn any long-form YouTube video (podcasts, lectures, interviews, talk shows) or local recording into high-engagement **9:16 vertical Shorts, Reels, and TikToks** with one click.

---

### Features

1. **AI Viral Moment & Hook Detection**:
   - Analyzes dialogue flow to detect punchy hooks, storytelling arcs, emotional spikes, and viral punchlines.
   - Computes a 1-100 Viral Potential Score.
   - Generates clickable hook titles, summary, and SEO hashtags (`#shorts #reels #viral`).

2. **Aspect Ratio Reframing Engine**:
   - **9:16 Cinematic Blur**: Scales horizontal 16:9 video into a focused center frame with an ambient blurred background.
   - **9:16 Center Crop**: Dynamically fills the vertical frame.
   - **9:16 Split Screen**: Stacks speaker and content vertically.
   - **1:1 Square Feed**: Formats content for square social feeds.
   - **16:9 Widescreen**: High-resolution widescreen cuts.

3. **Dynamic Animated Captions (Word-Level Karaoke)**:
   - Burns synchronized word-by-word highlighted subtitles (Hormozi Pill, MrBeast Pop, TikTok Pink, Cyber Neon, Minimal Pro, Deep Podcast).
   - Top hook banner with clean typography.
   - Interactive transcript allowing word-by-word spelling corrections before render.

4. **Interactive Studio Player & One-Click Download**:
   - Immediate live preview inside a device frame mockup.
   - Single-clip direct 1080p MP4 download.
   - Batch rendering and full `.zip` pack export.
   - Real-time audio energy waveform scrubber with playhead.

---

### Quick Start

#### 1. Setup Environment
```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. Run Application
```bash
python run.py
```
Open in browser: [http://localhost:8000](http://localhost:8000)

#### 3. Run Automated Tests
```bash
pytest tests/ -v
node scripts/verify-frontend.js
python scripts/audit_suite.py
```

---

### Tech Stack
- **Backend**: Python 3.11, FastAPI, Uvicorn, yt-dlp, FFmpeg, faster-whisper, NumPy
- **Frontend**: Vanilla HTML5, Tailwind CSS, Lucide Icons, Plus Jakarta Sans
- **Rendering**: FFmpeg with libass subtitle engine and word-level karaoke timing
