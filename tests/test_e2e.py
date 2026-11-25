import subprocess
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from backend.server import app
from backend.config import FFMPEG_PATH, OUTPUT_DIR

client = TestClient(app)

def test_full_pipeline_end_to_end():
    # 1. Step 1: User analyzes long-form video
    analyze_payload = {
        "url": "demo://creator-podcast",
        "target_duration": 45,
        "max_clips": 3
    }
    analyze_resp = client.post("/api/analyze", json=analyze_payload)
    assert analyze_resp.status_code == 200
    data = analyze_resp.json()
    
    assert "clips" in data
    assert len(data["clips"]) > 0
    top_clip = data["clips"][0]
    assert top_clip["score"] >= 80

    # 2. Step 2: User requests 9:16 Short generation
    gen_payload = {
        "url": "demo://creator-podcast",
        "start_time": top_clip["start_time"],
        "end_time": top_clip["start_time"] + 4.0, # Fast 4-second clip for e2e
        "hook_title": top_clip["hook_title"],
        "layout_style": "blur_margins",
        "caption_style": "hormozi"
    }
    gen_resp = client.post("/api/generate-clip", json=gen_payload)
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()

    assert "download_url" in gen_data
    assert "filename" in gen_data
    filename = gen_data["filename"]
    assert filename.endswith(".mp4")

    # 3. Step 3: User downloads generated MP4 file
    download_resp = client.get(f"/api/clips/{filename}")
    assert download_resp.status_code == 200
    assert download_resp.headers["content-type"] == "video/mp4"
    video_bytes = download_resp.content

    # Validate file size
    assert len(video_bytes) > 5000 # Greater than 5KB

    # Validate MP4 magic signature: contains 'ftyp' in first 16 bytes
    assert b"ftyp" in video_bytes[:32]

    # 4. Step 4: Verify vertical 9:16 aspect ratio (1080x1920) with FFmpeg
    saved_file = OUTPUT_DIR / filename
    assert saved_file.exists()
    
    probe = subprocess.run([FFMPEG_PATH, "-i", str(saved_file)], capture_output=True, text=True)
    assert "1080x1920" in probe.stderr

    print("\nE2E_PIPELINE_SUCCESS")
