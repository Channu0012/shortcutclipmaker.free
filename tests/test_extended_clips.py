import time
import subprocess
from fastapi.testclient import TestClient
from backend.server import app
from backend.highlighter import ClipHighlighter
from backend.transcriber import VideoTranscriber
from backend.video_processor import VideoProcessor
from backend.config import TEMP_DIR, FFMPEG_PATH

client = TestClient(app)


def test_highlighter_extended_3_to_4_minute_clips():
    """Verify highlighter supports 3 to 4 minute (180s - 240s) target duration."""
    transcriber = VideoTranscriber()
    segments = transcriber.get_transcript("demo://mastering-creator-economy")
    assert len(segments) > 0

    highlighter = ClipHighlighter(target_duration=210)
    clips = highlighter.find_highlights(segments, max_clips=10)
    assert len(clips) >= 4
    extended_clips = [c for c in clips if c["duration"] >= 120]
    assert len(extended_clips) >= 3


def test_distinct_demo_presets_return_distinct_content():
    r1 = client.post("/api/analyze", json={"url": "demo://creator-podcast", "target_duration": 45, "max_clips": 10})
    r2 = client.post("/api/analyze", json={"url": "demo://huberman-dopamine", "target_duration": 45, "max_clips": 10})
    r3 = client.post("/api/analyze", json={"url": "demo://hormozi-offers", "target_duration": 45, "max_clips": 10})
    assert r1.status_code == 200 and r2.status_code == 200 and r3.status_code == 200
    assert r1.json()["video_info"]["title"] != r2.json()["video_info"]["title"]
    assert r2.json()["video_info"]["title"] != r3.json()["video_info"]["title"]
    assert r2.json()["clips"][0]["hook_title"] != r3.json()["clips"][0]["hook_title"]


def test_async_job_analysis_polling():
    start_res = client.post("/api/analyze/start", json={"url": "demo://huberman-dopamine", "target_duration": 45, "max_clips": 10})
    assert start_res.status_code == 200
    job_id = start_res.json()["job_id"]

    final = None
    for _ in range(30):
        poll = client.get(f"/api/jobs/{job_id}")
        assert poll.status_code == 200
        body = poll.json()
        if body["status"] in ("completed", "failed"):
            final = body
            break
        time.sleep(0.1)

    assert final is not None and final["status"] == "completed", f"Unexpected job state: {final}"
    assert final["progress"] == 100
    assert len(final["result"]["clips"]) >= 8


def test_ass_clamping_emoji_and_aspect_resolution():
    """Verify early words outside clip_start do not stack at 0:00 and emojis strip cleanly."""
    proc = VideoProcessor()
    ass_path = TEMP_DIR / "test_square_clean.ass"
    segs = [
        {
            "start": 8.0,
            "end": 14.0,
            "text": "Before boundary words inside clip",
            "words": [
                {"word": "Before", "start": 8.0, "end": 9.0},
                {"word": "boundary", "start": 9.0, "end": 9.8},
                {"word": "Inside", "start": 10.2, "end": 11.2},
                {"word": "clip", "start": 11.2, "end": 12.2},
            ],
        }
    ]
    proc._generate_ass(
        segments=segs,
        clip_start=10.0,
        clip_end=14.0,
        hook_title="Amazing Hook Title That Wraps Cleanly 🚨🔥",
        output_ass_path=ass_path,
        style="hormozi",
        play_w=1080,
        play_h=1080,
    )
    txt = ass_path.read_text(encoding="utf-8")
    assert "PlayResX: 1080" in txt
    assert "PlayResY: 1080" in txt
    assert "BEFORE" not in txt
    assert "INSIDE" in txt
    assert "🚨" not in txt


def test_square_and_custom_words_clip_generation():
    payload = {
        "url": "demo://hormozi-offers",
        "start_time": 8.0,
        "end_time": 12.0,
        "hook_title": "Custom Edited Banner 🔥",
        "layout_style": "square_1_1",
        "caption_style": "mrbeast",
        "show_hook_banner": True,
        "custom_words": [
            {"word": "Custom", "start": 8.2, "end": 9.0},
            {"word": "Edited", "start": 9.0, "end": 10.0},
            {"word": "Captions", "start": 10.0, "end": 11.5},
        ],
    }
    res = client.post("/api/generate-clip", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["layout_style"] == "square_1_1"
    assert len(data["waveform"]) == 48
    probe = subprocess.run([FFMPEG_PATH, "-i", f"storage/clips/{data['filename']}"], capture_output=True, text=True)
    assert "1080x1080" in probe.stderr


def test_generate_clip_allows_extended_duration():
    payload = {
        "url": "demo://mastering-creator-economy",
        "start_time": 10.0,
        "end_time": 210.0,
        "hook_title": "Extended 3-Minute Masterclass Clip",
        "layout_style": "blur_margins",
        "caption_style": "hormozi",
    }
    response = client.post("/api/generate-clip", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["duration"] == 200.0
    assert data["file_size"] > 1000


def test_settings_api_key_endpoint():
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert data["api_key_configured"] is True
    assert "94981c" in data["api_key_masked"]
    assert data["max_clip_seconds"] == 360


def test_landscape_16_9_render_and_delete():
    payload = {
        "url": "demo://creator-podcast",
        "start_time": 10.0,
        "end_time": 13.0,
        "hook_title": "Widescreen Highlight",
        "layout_style": "landscape_16_9",
        "caption_style": "tiktok",
        "show_hook_banner": False,
    }
    res = client.post("/api/generate-clip", json=payload)
    assert res.status_code == 200
    data = res.json()
    probe = subprocess.run([FFMPEG_PATH, "-i", f"storage/clips/{data['filename']}"], capture_output=True, text=True)
    assert "1920x1080" in probe.stderr

    # Delete individual clip cleanly
    del_res = client.delete(f"/api/clips/{data['filename']}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"


def test_local_binary_stream_upload_and_storage_stats():
    from backend.downloader import VideoDownloader
    raw_up = TEMP_DIR / "sample_upload_src.mp4"
    VideoDownloader()._generate_synthetic_video(0.0, 2.0, raw_up, "Upload Test")
    raw_bytes = raw_up.read_bytes()
    raw_up.unlink(missing_ok=True)

    up_res = client.post("/api/upload-video?filename=studio_podcast_test.mp4", content=raw_bytes)
    assert up_res.status_code == 200
    up_data = up_res.json()
    assert up_data["url"].startswith("local://")
    assert up_data["video_info"]["is_local"] is True
    assert up_data["video_info"]["duration"] >= 1

    stats_res = client.get("/api/storage-stats")
    assert stats_res.status_code == 200
    assert "clips_count" in stats_res.json()

