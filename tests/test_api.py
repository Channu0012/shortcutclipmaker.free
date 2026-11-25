import pytest
from fastapi.testclient import TestClient
from backend.server import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["ready"] is True

def test_sample_demo_endpoint_has_10_plus_clips():
    response = client.get("/api/sample-demo")
    assert response.status_code == 200
    data = response.json()
    assert "video_info" in data
    assert "clips" in data
    assert len(data["clips"]) >= 10, f"Expected at least 10 clips, got {len(data['clips'])}"

def test_analyze_endpoint_produces_10_plus_clips():
    payload = {
        "url": "demo://test-creator-video",
        "target_duration": 45,
        "max_clips": 12
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "video_info" in data
    assert "clips" in data
    assert len(data["clips"]) >= 10

def test_generate_and_download_clip_endpoint():
    payload = {
        "url": "demo://test-creator-video",
        "start_time": 15.0,
        "end_time": 18.0,
        "hook_title": "Api Test Hook 🔥",
        "layout_style": "blur_margins",
        "caption_style": "hormozi"
    }
    res = client.post("/api/generate-clip", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "download_url" in data
    assert "clip_id" in data
    filename = data["filename"]

    clip_res = client.get(f"/api/clips/{filename}")
    assert clip_res.status_code == 200
    assert clip_res.headers["content-type"] == "video/mp4"
    assert len(clip_res.content) > 1000

def test_zip_export_endpoint():
    res = client.get("/api/download-all-zip")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/zip"
    assert len(res.content) > 500
