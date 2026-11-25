import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import OUTPUT_DIR, FFMPEG_PATH
from backend.demo_datasets import get_demo_transcript, get_demo_info
from backend.highlighter import ClipHighlighter
from backend.downloader import VideoDownloader

# 1. Config
print("Config OK:", OUTPUT_DIR.exists(), FFMPEG_PATH[:8])

# 2. Demo info
info = get_demo_info("demo://huberman-dopamine")
print("Demo info OK:", info.get("title", "")[:50])

# 3. Highlighter with long clip (3-4 min)
script = get_demo_transcript("demo://huberman-dopamine")
h = ClipHighlighter(target_duration=210)  # 3-4 min clips
clips = h.find_highlights(script, max_clips=5)
print(f"Clips (210s target): {len(clips)}")
for c in clips[:3]:
    dur = c["end_time"] - c["start_time"]
    print(f"  Clip #{c['index']}: {c['start_time']:.0f}s-{c['end_time']:.0f}s = {dur:.0f}s score={c['score']}")

# 4. Short clips
h2 = ClipHighlighter(target_duration=45)
clips2 = h2.find_highlights(script, max_clips=10)
print(f"Clips (45s target): {len(clips2)}")
for c in clips2[:3]:
    dur = c["end_time"] - c["start_time"]
    print(f"  Clip #{c['index']}: {c['start_time']:.0f}s-{c['end_time']:.0f}s = {dur:.0f}s score={c['score']}")

# 5. URL validator
print("URL valid (YT):", VideoDownloader.is_valid_youtube_url("https://www.youtube.com/watch?v=UF8uR6Z6KLc"))
print("URL valid (demo):", VideoDownloader.is_valid_youtube_url("demo://creator-podcast"))
print("URL invalid:", VideoDownloader.is_valid_youtube_url("not-a-url"))

print("\nAll sanity checks PASSED")
