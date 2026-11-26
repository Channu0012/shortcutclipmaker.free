import base64
import inspect
import re
import tempfile
import threading
import time
import uuid
import zipfile
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.caption_templates import list_caption_templates
from backend.config import BASE_DIR, COOKIES_PATH, IS_VERCEL, OUTPUT_DIR, TEMP_DIR, UPLOADS_DIR
from backend.downloader import VideoDownloader
from backend.highlighter import ClipHighlighter
from backend.transcriber import VideoTranscriber
from backend.video_processor import VideoProcessor

app = FastAPI(
    title="Klipnux — Video Clip Studio Engine",
    description="Video clip engine turning long YouTube and local videos into ready-to-post 9:16, 1:1, and 16:9 clips.",
    version="3.2.0",
)

_cors_kwargs: Dict[str, Any] = {
    "allow_origins": ["*"],
    "allow_credentials": False,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if "allow_private_network" in inspect.signature(CORSMiddleware.__init__).parameters:
    _cors_kwargs["allow_private_network"] = True
app.add_middleware(CORSMiddleware, **_cors_kwargs)


@app.middleware("http")
async def add_pna_and_cache_headers(request: Request, call_next):
    response = await call_next(request)
    # Allow explicit opt-in Local Engine bridge from HTTPS deployment (Chrome Private Network Access)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    if request.url.path in ("/", "/index.html", "/app.js", "/style.css"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


downloader = VideoDownloader()
transcriber = VideoTranscriber()
processor = VideoProcessor()

ANALYSIS_JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()


class AnalyzeRequest(BaseModel):
    url: str = Field(..., description="YouTube video URL, local://filename, or demo://preset")
    target_duration: int = Field(45, ge=15, le=360)
    max_clips: int = Field(12, ge=1, le=25)
    api_key: Optional[str] = None
    cookies_txt: Optional[str] = None


class GenerateClipRequest(BaseModel):
    url: str
    start_time: float
    end_time: float
    hook_title: str
    layout_style: str = "blur_margins"
    caption_style: str = "hormozi"
    show_hook_banner: bool = True
    custom_words: Optional[List[Dict[str, Any]]] = None
    api_key: Optional[str] = None
    cookies_txt: Optional[str] = None


class BatchGenerateRequest(BaseModel):
    url: str
    clips: List[Dict[str, Any]]
    layout_style: str = "blur_margins"
    caption_style: str = "hormozi"
    show_hook_banner: bool = True
    api_key: Optional[str] = None
    cookies_txt: Optional[str] = None


class ZipSelectionRequest(BaseModel):
    filenames: List[str] = Field(default_factory=list)


class SettingsUpdate(BaseModel):
    api_key: Optional[str] = ""
    cookies_txt: Optional[str] = None


@contextmanager
def _scoped_cookie_file(cookies_txt: Optional[str]):
    """Writes stateless per-request Netscape cookies to a temp file safely deleted after request."""
    clean = (cookies_txt or "").strip()
    if not clean:
        yield None
        return
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", prefix="klip_ck_", dir=str(TEMP_DIR), delete=False, encoding="utf-8")
    tmp_path = Path(tmp.name)
    try:
        tmp.write(clean + "\n")
        tmp.close()
        yield tmp_path
    finally:
        _safe_unlink(tmp_path)


def _run_analysis_sync(
    url: str,
    target_duration: int,
    max_clips: int,
    progress_update: Optional[Any] = None,
    cookies_txt: Optional[str] = None,
) -> Dict[str, Any]:
    clean_url = url.strip()
    if not VideoDownloader.is_valid_youtube_url(clean_url):
        raise ValueError("Please provide a valid YouTube URL, uploaded video, or preset demo.")

    with _scoped_cookie_file(cookies_txt) as ck_path:
        if progress_update:
            progress_update(18, "1. Fetching Metadata...", "Connecting to video source and inspecting duration...")
        info = downloader.get_video_info(clean_url, cookie_file=ck_path)

        def on_transcript_msg(msg: str) -> None:
            if progress_update:
                progress_update(48, "2. Reading Transcript...", msg)

        if progress_update:
            progress_update(42, "2. Extracting Speech Transcript...", "Checking captions & word-level timestamps...")
        segments = transcriber.get_transcript(
            clean_url,
            progress_cb=on_transcript_msg,
            cookie_file=ck_path,
            video_info=info,
        )
        if not segments:
            raise RuntimeError("No speech transcript could be retrieved for this video.")

        if progress_update:
            progress_update(78, "3. Scoring Moments...", f"Selecting top {max_clips} highlights...")

        highlighter = ClipHighlighter(target_duration=target_duration)
        clips = highlighter.find_highlights(segments, max_clips=max_clips)

        if progress_update:
            progress_update(96, "4. Preparing Studio...", f"Prepared {len(clips)} clips ready to cut.")

        return {
            "url": clean_url,
            "video_info": info,
            "clips": clips,
            "total_clips": len(clips),
            "segments_count": len(segments),
            "timeline_duration": max(float(segments[-1]["end"] if segments else 0), float(info.get("duration", 0))),
        }


@app.get("/api/health")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Klipnux Clip Engine",
        "version": "3.2.0",
        "serverless": IS_VERCEL,
        "cookies_configured": COOKIES_PATH.exists() and COOKIES_PATH.stat().st_size > 20,
        "ready": True,
    }


@app.get("/api/caption-styles")
@app.get("/caption-styles")
def get_caption_styles():
    return list_caption_templates()


@app.get("/api/sample-demo")
@app.get("/sample-demo")
def get_sample_demo(
    preset: str = Query("creator-podcast"),
    target_duration: int = Query(45, ge=15, le=360),
    max_clips: int = Query(12, ge=1, le=25),
):
    demo_url = f"demo://{preset.strip()}"
    try:
        return _run_analysis_sync(demo_url, target_duration=target_duration, max_clips=max_clips)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/analyze")
@app.post("/analyze")
def analyze_video(req: AnalyzeRequest):
    try:
        return _run_analysis_sync(req.url, req.target_duration, req.max_clips, cookies_txt=req.cookies_txt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/api/analyze/start")
@app.post("/analyze/start")
def start_analyze_job(req: AnalyzeRequest):
    if not VideoDownloader.is_valid_youtube_url(req.url.strip()):
        raise HTTPException(status_code=400, detail="Please provide a valid YouTube URL or demo/local video.")

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    now = time.time()

    if IS_VERCEL:
        try:
            result = _run_analysis_sync(req.url, req.target_duration, req.max_clips, cookies_txt=req.cookies_txt)
            return {
                "job_id": job_id,
                "status": "completed",
                "progress": 100,
                "step": 4,
                "title": "Analysis Complete",
                "detail": f"Prepared {result['total_clips']} clips ready to cut.",
                "elapsed": round(time.time() - now, 1),
                "result": result,
            }
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    with JOBS_LOCK:
        ANALYSIS_JOBS[job_id] = {
            "job_id": job_id,
            "status": "running",
            "progress": 8,
            "step": 1,
            "title": "Connecting to klipnux...",
            "detail": "Preparing video source...",
            "started_at": now,
            "elapsed": 0.0,
            "result": None,
            "error": None,
        }

    def worker():
        def update_cb(pct: int, title: str, detail: str):
            step_num = 1 if pct < 35 else (2 if pct < 70 else (3 if pct < 95 else 4))
            with JOBS_LOCK:
                if job_id in ANALYSIS_JOBS:
                    ANALYSIS_JOBS[job_id].update({
                        "progress": pct,
                        "step": step_num,
                        "title": title,
                        "detail": detail,
                        "elapsed": round(time.time() - now, 1),
                    })

        try:
            result = _run_analysis_sync(
                req.url, req.target_duration, req.max_clips, progress_update=update_cb, cookies_txt=req.cookies_txt
            )
            with JOBS_LOCK:
                if job_id in ANALYSIS_JOBS:
                    ANALYSIS_JOBS[job_id].update({
                        "status": "completed",
                        "progress": 100,
                        "step": 4,
                        "title": "Clips Ready",
                        "detail": f"Selected {result['total_clips']} moments.",
                        "elapsed": round(time.time() - now, 1),
                        "result": result,
                    })
        except Exception as exc:
            with JOBS_LOCK:
                if job_id in ANALYSIS_JOBS:
                    ANALYSIS_JOBS[job_id].update({
                        "status": "failed",
                        "progress": 100,
                        "title": "Analysis Failed",
                        "detail": str(exc),
                        "elapsed": round(time.time() - now, 1),
                        "error": str(exc),
                    })

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": job_id, "status": "running"}


@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str):
    with JOBS_LOCK:
        job = ANALYSIS_JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Analysis job not found.")
        payload = dict(job)
        if payload["status"] == "running":
            payload["elapsed"] = round(time.time() - payload["started_at"], 1)
        return payload


@app.post("/api/upload-video")
async def upload_local_video(request: Request, filename: str = Query("klipnux_upload.mp4")):
    orig_name = Path(filename).name or "klipnux_upload.mp4"
    ext = Path(orig_name).suffix.lower()
    if ext not in (".mp4", ".mov", ".mkv", ".webm", ".m4v"):
        raise HTTPException(status_code=400, detail="Unsupported video format. Upload MP4, MOV, MKV, or WEBM.")

    safe_stem = re.sub(r"[^a-zA-Z0-9_-]", "_", Path(orig_name).stem)[:40]
    unique_name = f"{safe_stem}_{uuid.uuid4().hex[:6]}{ext}"
    dest_path = UPLOADS_DIR / unique_name

    total_bytes = 0
    with dest_path.open("wb") as buffer:
        async for chunk in request.stream():
            if chunk:
                buffer.write(chunk)
                total_bytes += len(chunk)

    if total_bytes < 1000:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded video file is empty or corrupt.")

    local_url = f"local://{unique_name}"
    info = downloader.get_video_info(local_url)
    return {
        "url": local_url,
        "filename": unique_name,
        "size_mb": round(total_bytes / (1024 * 1024), 2),
        "video_info": info,
    }


@app.get("/api/settings")
@app.get("/settings")
def get_settings():
    from backend.config import USER_API_KEY
    masked_key = f"{USER_API_KEY[:6]}...{USER_API_KEY[-4:]}" if len(USER_API_KEY) > 10 else USER_API_KEY
    return {
        "api_key_configured": bool(USER_API_KEY),
        "api_key_masked": masked_key,
        "cookies_configured": COOKIES_PATH.exists() and COOKIES_PATH.stat().st_size > 20,
        "max_clip_seconds": 360,
        "serverless": IS_VERCEL,
        "status": "ready",
    }


@app.post("/api/settings")
@app.post("/settings")
def update_settings(req: SettingsUpdate):
    import backend.config as cfg
    new_key = (req.api_key or "").strip()
    updated_cookies = False

    if req.cookies_txt is not None:
        cookies_clean = req.cookies_txt.strip()
        if cookies_clean:
            COOKIES_PATH.write_text(cookies_clean + "\n", encoding="utf-8")
            updated_cookies = True
        else:
            COOKIES_PATH.unlink(missing_ok=True)

    if new_key:
        cfg.USER_API_KEY = new_key
        cfg.ASSEMBLYAI_API_KEY = new_key
        cfg.PEXELS_API_KEY = new_key
        return {
            "status": "updated",
            "api_key_masked": f"{new_key[:6]}...{new_key[-4:]}",
            "cookies_configured": COOKIES_PATH.exists() and COOKIES_PATH.stat().st_size > 20,
        }

    if updated_cookies or req.cookies_txt is not None:
        return {
            "status": "updated",
            "cookies_configured": COOKIES_PATH.exists() and COOKIES_PATH.stat().st_size > 20,
        }
    return {"status": "unchanged"}


@app.post("/api/generate-clip")
@app.post("/generate-clip")
def generate_clip(req: GenerateClipRequest):
    duration = float(req.end_time) - float(req.start_time)
    if duration <= 0 or duration > 360:
        raise HTTPException(status_code=400, detail="Invalid clip duration (must be between 1s and 360s).")

    clip_id = f"clip_{uuid.uuid4().hex[:10]}"
    output_filename = f"{clip_id}.mp4"
    source_filename = f"raw_{clip_id}.mp4"
    source_video_path: Optional[Path] = None

    try:
        with _scoped_cookie_file(req.cookies_txt) as ck_path:
            source_video_path = downloader.download_segment(
                url=req.url,
                start_sec=req.start_time,
                end_sec=req.end_time,
                output_filename=source_filename,
                cookie_file=ck_path,
            )

            if req.custom_words and len(req.custom_words) > 0:
                segments = [{
                    "start": req.start_time,
                    "end": req.end_time,
                    "text": " ".join(str(w.get("word", "")) for w in req.custom_words),
                    "words": req.custom_words,
                }]
            else:
                segments = transcriber.get_transcript(req.url, cookie_file=ck_path)

        final_path = processor.create_short(
            input_video_path=source_video_path,
            start_time=req.start_time,
            end_time=req.end_time,
            hook_title=req.hook_title,
            segments=segments,
            output_filename=output_filename,
            layout_style=req.layout_style,
            caption_style=req.caption_style,
            input_is_trimmed=True,
            show_hook_banner=req.show_hook_banner,
        )

        if not final_path.exists() or final_path.stat().st_size < 1000:
            raise HTTPException(status_code=500, detail="Failed to render video clip.")

        file_size = final_path.stat().st_size
        waveform_peaks = VideoDownloader.extract_waveform_peaks(final_path, num_bars=48)

        payload: Dict[str, Any] = {
            "clip_id": clip_id,
            "filename": output_filename,
            "download_url": f"/api/clips/{output_filename}",
            "stream_url": f"/api/clips/{output_filename}?play=true&t={int(time.time())}",
            "duration": round(duration, 2),
            "title": req.hook_title,
            "layout_style": req.layout_style,
            "caption_style": req.caption_style,
            "file_size": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2),
            "waveform": waveform_peaks,
        }

        if IS_VERCEL and file_size <= 2_400_000:
            payload["inline_mp4_base64"] = base64.b64encode(final_path.read_bytes()).decode("ascii")

        return payload
    except HTTPException:
        raise
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Clip render failed: {exc}")
    finally:
        if source_video_path and source_video_path.exists():
            _safe_unlink(source_video_path)


@app.post("/api/batch-generate")
def batch_generate(req: BatchGenerateRequest):
    results = []
    for c in req.clips:
        start_t = float(c.get("start_time", 0.0))
        end_t = float(c.get("end_time", start_t + 30.0))
        hook = c.get("hook_title", "Viral Short")

        single_req = GenerateClipRequest(
            url=req.url,
            start_time=start_t,
            end_time=end_t,
            hook_title=hook,
            layout_style=req.layout_style,
            caption_style=req.caption_style,
            show_hook_banner=req.show_hook_banner,
            custom_words=c.get("custom_words"),
            cookies_txt=req.cookies_txt,
        )
        try:
            res = generate_clip(single_req)
            res["original_clip_id"] = c.get("id")
            results.append(res)
        except Exception as exc:
            detail_msg = getattr(exc, "detail", str(exc))
            results.append({
                "original_clip_id": c.get("id"),
                "error": detail_msg,
            })
    return {"rendered_clips": results, "total": len(results)}


@app.get("/api/download-all-zip")
@app.get("/download-all-zip")
def download_all_zip():
    mp4_files = list(OUTPUT_DIR.glob("*.mp4"))
    if not mp4_files:
        raise HTTPException(status_code=404, detail="No rendered clips available to download.")

    zip_path = TEMP_DIR / f"klipnux_all_{uuid.uuid4().hex[:6]}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for f in mp4_files:
            zipf.write(f, arcname=f.name)

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename="klipnux_viral_shorts_pack.zip",
        headers={"Content-Disposition": 'attachment; filename="klipnux_viral_shorts_pack.zip"'},
    )


@app.post("/api/download-zip")
@app.post("/download-zip")
def download_selected_zip(req: ZipSelectionRequest):
    if req.filenames:
        mp4_files = [OUTPUT_DIR / Path(fn).name for fn in req.filenames if (OUTPUT_DIR / Path(fn).name).exists()]
    else:
        mp4_files = list(OUTPUT_DIR.glob("*.mp4"))

    if not mp4_files:
        raise HTTPException(status_code=404, detail="No rendered clips selected or found.")

    zip_path = TEMP_DIR / f"klipnux_pack_{uuid.uuid4().hex[:6]}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for f in mp4_files:
            zipf.write(f, arcname=f.name)

    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename="klipnux_viral_shorts_pack.zip",
        headers={"Content-Disposition": 'attachment; filename="klipnux_viral_shorts_pack.zip"'},
    )


@app.get("/api/storage-stats")
@app.get("/storage-stats")
def storage_stats():
    mp4_files = list(OUTPUT_DIR.glob("*.mp4"))
    if not mp4_files and (BASE_DIR / "storage" / "clips").exists():
        mp4_files = list((BASE_DIR / "storage" / "clips").glob("*.mp4"))
    total_bytes = sum(f.stat().st_size for f in mp4_files)
    temp_bytes = sum(f.stat().st_size for f in TEMP_DIR.glob("*") if f.is_file())
    return {
        "clips_count": len(mp4_files),
        "clips_mb": round(total_bytes / (1024 * 1024), 2),
        "temp_mb": round(temp_bytes / (1024 * 1024), 2),
    }


def _safe_unlink(path: Path) -> bool:
    try:
        path.unlink(missing_ok=True)
        return True
    except OSError:
        return False


@app.delete("/api/clips/{filename}")
@app.delete("/clips/{filename}")
def delete_single_clip(filename: str):
    safe_name = Path(filename).name
    target = OUTPUT_DIR / safe_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Clip not found.")
    if not _safe_unlink(target):
        raise HTTPException(status_code=409, detail="Clip is currently playing or locked; pause video and retry.")
    return {"status": "deleted", "filename": safe_name}


@app.delete("/api/clips")
@app.delete("/clips")
@app.post("/api/clear-storage")
@app.post("/clear-storage")
def clear_storage():
    count = 0
    locked = 0
    for folder in (OUTPUT_DIR, TEMP_DIR, UPLOADS_DIR):
        for p in folder.glob("*"):
            if p.is_file() and p != COOKIES_PATH and p.name != ".gitkeep":
                if _safe_unlink(p):
                    count += 1
                else:
                    locked += 1
    transcriber.clear_cache()
    downloader._info_cache.clear()
    return {
        "status": "cleared",
        "deleted_files": count,
        "locked_skipped": locked,
        "message": "Storage wiped cleanly." if locked == 0 else f"Cleared {count} files ({locked} in-use skipped).",
    }


@app.get("/api/clips")
@app.get("/clips")
def list_clips():
    mp4_files = sorted(OUTPUT_DIR.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not mp4_files and (BASE_DIR / "storage" / "clips").exists():
        mp4_files = sorted((BASE_DIR / "storage" / "clips").glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    clips = []
    for f in mp4_files:
        clips.append({
            "filename": f.name,
            "download_url": f"/api/clips/{f.name}",
            "stream_url": f"/api/clips/{f.name}?play=true",
            "size_bytes": f.stat().st_size,
            "size_mb": round(f.stat().st_size / (1024 * 1024), 2),
        })
    return {"clips": clips, "count": len(clips)}


@app.get("/api/assets/thumb/{filename}")
@app.get("/assets/thumb/{filename}")
def get_thumb_asset(filename: str):
    safe_name = Path(filename).name
    thumb_path = TEMP_DIR / safe_name
    if not thumb_path.exists():
        fallback_thumb = BASE_DIR / "storage" / "temp" / safe_name
        if fallback_thumb.exists():
            thumb_path = fallback_thumb
        else:
            raise HTTPException(status_code=404, detail="Thumbnail not found.")
    return FileResponse(path=thumb_path, media_type="image/jpeg")


@app.get("/api/clips/{filename}")
@app.get("/clips/{filename}")
def get_clip_file(filename: str, play: bool = False):
    safe_name = Path(filename).name
    file_path = OUTPUT_DIR / safe_name
    if not file_path.exists():
        fallback_path = BASE_DIR / "storage" / "clips" / safe_name
        if fallback_path.exists():
            file_path = fallback_path
        else:
            fallback_public = BASE_DIR / "public" / "assets" / safe_name
            if fallback_public.exists():
                file_path = fallback_public
            else:
                raise HTTPException(status_code=404, detail="Requested clip was not found.")

    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
    }
    if not play:
        headers["Content-Disposition"] = f'attachment; filename="{safe_name}"'

    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=safe_name,
        headers=headers,
    )


@app.get("/api/uploads/{filename}")
def get_uploaded_video(filename: str):
    safe_name = Path(filename).name
    file_path = UPLOADS_DIR / safe_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Uploaded file not found.")
    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=safe_name,
        headers={"Accept-Ranges": "bytes"},
    )


frontend_dist = BASE_DIR / "frontend" / "dist"
if not frontend_dist.exists() or not (frontend_dist / "index.html").exists():
    frontend_dist = BASE_DIR / "public"

if frontend_dist.exists():
    @app.get("/")
    def serve_index():
        return FileResponse(frontend_dist / "index.html")

    @app.get("/favicon.ico")
    def serve_favicon():
        ico_png = frontend_dist / "assets" / "favicon-32x32.png"
        if ico_png.exists():
            return FileResponse(ico_png, media_type="image/png")
        raise HTTPException(status_code=404, detail="Favicon not found.")

    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
