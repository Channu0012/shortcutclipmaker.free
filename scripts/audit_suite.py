import sys
import os
import re
from pathlib import Path

# Add project root to path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from starlette.testclient import TestClient
from backend.server import app, OUTPUT_DIR, TEMP_DIR

client = TestClient(app)

print("=" * 60)
print("  KLIPNUX STUDIO -- COMPREHENSIVE PRODUCTION AUDIT")
print("=" * 60)

passed = 0
failed = 0

def test(name, condition, details=""):
    global passed, failed
    if condition:
        print(f" [PASS] {name}")
        passed += 1
    else:
        print(f" [FAIL] {name}: {details}")
        failed += 1

# 1. Health
r = client.get("/api/health")
test("API Health 200 OK", r.status_code == 200 and r.json().get("status") == "healthy")

# 2. Frontend assets
r_html = client.get("/")
test("Frontend index.html 200 OK", r_html.status_code == 200 and "Klipnux" in r_html.text)
test("Frontend index.html has no emojis", not re.search(r'[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F600-\U0001F64F\U0001F900-\U0001F9FF]', r_html.text))

r_js = client.get("/app.js")
test("Frontend app.js 200 OK", r_js.status_code == 200 and "DOMContentLoaded" in r_js.text)

r_css = client.get("/style.css")
test("Frontend style.css 200 OK", r_css.status_code == 200 and "--bg-canvas" in r_css.text)

# 3. Settings endpoint
r_set = client.get("/api/settings")
test("Settings GET 200 OK", r_set.status_code == 200 and "api_key_masked" in r_set.json())

r_up_set = client.post("/api/settings", json={"api_key": "94981c070f66fc789321d87774f7e89f"})
test("Settings POST 200 OK", r_up_set.status_code == 200 and r_up_set.json().get("status") == "updated")

# 4. Caption styles
r_styles = client.get("/api/caption-styles")
test("Caption styles 200 OK", r_styles.status_code == 200 and len(r_styles.json()) >= 6)

# 5. Presets
for preset in ["creator-podcast", "huberman-dopamine", "hormozi-offers"]:
    r_pre = client.get(f"/api/sample-demo?preset={preset}&target_duration=45&max_clips=5")
    d = r_pre.json()
    test(f"Preset {preset} 200 OK", r_pre.status_code == 200 and len(d.get("clips", [])) >= 5)

# 6. Analyze endpoint with long 3-4 min clip duration
r_ana = client.post("/api/analyze", json={
    "url": "demo://huberman-dopamine",
    "target_duration": 210,
    "max_clips": 5
})
test("Analyze 210s clips 200 OK", r_ana.status_code == 200)
ana_data = r_ana.json()
clips = ana_data.get("clips", [])
test("Analyze returned 5 clips", len(clips) == 5)
if clips:
    first_clip = clips[0]
    dur = first_clip["end_time"] - first_clip["start_time"]
    test("First clip duration > 60s for 210s target", dur >= 60, f"Actual: {dur:.1f}s")
    test("Virality breakdown exists", "virality_breakdown" in first_clip)
    test("SEO hashtags exist", len(first_clip.get("hashtags", [])) > 0)
    test("No emojis in clip hook title", not re.search(r'[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F600-\U0001F64F\U0001F900-\U0001F9FF]', first_clip["hook_title"]))

# 7. Render 9:16 clip
r_gen_916 = client.post("/api/generate-clip", json={
    "url": "demo://creator-podcast",
    "start_time": 10.0,
    "end_time": 25.0,
    "hook_title": "Clean Creator Hook",
    "layout_style": "blur_margins",
    "caption_style": "hormozi",
    "show_hook_banner": True
})
test("Render 9:16 clip 200 OK", r_gen_916.status_code == 200)
c916 = r_gen_916.json()
fn_916 = c916.get("filename")
test("Render 9:16 produced valid MP4", fn_916 and (OUTPUT_DIR / fn_916).exists())
test("Render 9:16 file size > 50KB", (OUTPUT_DIR / fn_916).stat().st_size > 50000)

# 8. Render 1:1 Square clip
r_gen_11 = client.post("/api/generate-clip", json={
    "url": "demo://creator-podcast",
    "start_time": 10.0,
    "end_time": 22.0,
    "hook_title": "Square Format Hook",
    "layout_style": "square_1_1",
    "caption_style": "mrbeast",
    "show_hook_banner": True
})
test("Render 1:1 square clip 200 OK", r_gen_11.status_code == 200)

# 9. Render 16:9 Landscape clip
r_gen_169 = client.post("/api/generate-clip", json={
    "url": "demo://creator-podcast",
    "start_time": 10.0,
    "end_time": 22.0,
    "hook_title": "Widescreen Cut",
    "layout_style": "landscape_16_9",
    "caption_style": "minimal",
    "show_hook_banner": False
})
test("Render 16:9 landscape clip 200 OK", r_gen_169.status_code == 200)

# 10. Render with custom user-edited words
r_custom = client.post("/api/generate-clip", json={
    "url": "demo://creator-podcast",
    "start_time": 10.0,
    "end_time": 20.0,
    "hook_title": "Custom Word Test",
    "layout_style": "blur_margins",
    "caption_style": "hormozi",
    "custom_words": [
        {"word": "UNSTOPPABLE", "start": 10.5, "end": 13.0},
        {"word": "MOMENTUM", "start": 13.2, "end": 16.0},
        {"word": "NOW", "start": 16.2, "end": 19.0}
    ]
})
test("Render custom words 200 OK", r_custom.status_code == 200)

# 11. Stream & Download clip file endpoints
r_stream = client.get(f"/api/clips/{fn_916}?play=true")
test("Stream video 200 OK", r_stream.status_code == 200)
test("Stream video Accept-Ranges header", r_stream.headers.get("accept-ranges") == "bytes")
test("Stream video Content-Type video/mp4", "video/mp4" in r_stream.headers.get("content-type", ""))

r_download = client.get(f"/api/clips/{fn_916}")
test("Download video 200 OK", r_download.status_code == 200)
test("Download video Content-Disposition attachment", "attachment" in r_download.headers.get("content-disposition", ""))

# 12. List clips
r_clips = client.get("/api/clips")
test("List clips 200 OK", r_clips.status_code == 200 and len(r_clips.json().get("clips", [])) >= 3)

# 13. Download ZIP of all clips
r_zip_all = client.get("/api/download-all-zip")
test("Download all ZIP 200 OK", r_zip_all.status_code == 200 and "zip" in r_zip_all.headers.get("content-type", ""))

# 14. Download ZIP of selected clips
r_zip_sel = client.post("/api/download-zip", json={"filenames": [fn_916]})
test("Download selected ZIP 200 OK", r_zip_sel.status_code == 200)

# 15. Storage stats
r_stats = client.get("/api/storage-stats")
test("Storage stats 200 OK", r_stats.status_code == 200 and r_stats.json().get("clips_count") >= 3)

# 16. Async job start and poll
r_start_job = client.post("/api/analyze/start", json={
    "url": "demo://creator-podcast",
    "target_duration": 45,
    "max_clips": 5
})
test("Async job start 200 OK", r_start_job.status_code == 200)
job_id = r_start_job.json().get("job_id")
test("Async job ID generated", job_id and job_id.startswith("job_"))

import time
completed = False
for _ in range(30):
    time.sleep(0.3)
    r_job = client.get(f"/api/jobs/{job_id}")
    if r_job.status_code == 200 and r_job.json().get("status") == "completed":
        completed = True
        break
test("Async job completed successfully", completed)

print("=" * 60)
print(f"  AUDIT RESULTS: {passed} PASSED, {failed} FAILED")
print("=" * 60)

if failed > 0:
    sys.exit(1)
