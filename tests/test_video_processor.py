import subprocess
from pathlib import Path
import pytest
from backend.downloader import VideoDownloader
from backend.video_processor import VideoProcessor
from backend.config import TEMP_DIR, OUTPUT_DIR, FFMPEG_PATH

def test_ass_subtitle_generation():
    processor = VideoProcessor()
    ass_path = TEMP_DIR / "test_sub.ass"
    dummy_segments = [
        {
            "start": 0.0,
            "end": 2.5,
            "text": "Volume creates skill.",
            "words": [
                {"word": "Volume", "start": 0.0, "end": 0.8},
                {"word": "creates", "start": 0.8, "end": 1.6},
                {"word": "skill.", "start": 1.6, "end": 2.5}
            ]
        }
    ]
    processor._generate_ass(
        segments=dummy_segments,
        clip_start=0.0,
        clip_end=3.0,
        hook_title="Stop Waiting To Be Ready 🛑",
        output_ass_path=ass_path,
        style="hormozi"
    )
    assert ass_path.exists()
    content = ass_path.read_text(encoding="utf-8")
    assert "PlayResX: 1080" in content
    assert "PlayResY: 1920" in content
    assert "STOP WAITING TO BE READY" in content
    assert "VOLUME" in content

def test_create_short_video_rendering():
    downloader = VideoDownloader(temp_dir := TEMP_DIR)
    processor = VideoProcessor(output_dir := OUTPUT_DIR, temp_dir=temp_dir)
    
    # 1. Create a 3-second source synthetic 16:9 video
    raw_video = temp_dir / "raw_test_source.mp4"
    downloader._generate_synthetic_video(0.0, 3.0, raw_video, "Test Source")
    assert raw_video.exists()

    # 2. Process to 9:16 vertical short
    dummy_segments = [
        {
            "start": 0.0,
            "end": 3.0,
            "text": "Consistency beats talent every time.",
            "words": [
                {"word": "Consistency", "start": 0.0, "end": 1.0},
                {"word": "beats", "start": 1.0, "end": 1.8},
                {"word": "talent.", "start": 1.8, "end": 3.0}
            ]
        }
    ]

    out_file = "test_rendered_short.mp4"
    rendered = processor.create_short(
        input_video_path=raw_video,
        start_time=0.0,
        end_time=3.0,
        hook_title="Consistency Beats Talent 🔥",
        segments=dummy_segments,
        output_filename=out_file,
        layout_style="blur_margins",
        caption_style="hormozi"
    )

    assert rendered.exists()
    assert rendered.stat().st_size > 1000 # Greater than 1KB

    # 3. Verify video stream resolution with ffmpeg
    cmd = [
        FFMPEG_PATH, "-i", str(rendered)
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    # FFmpeg outputs stream info in stderr: e.g. "Stream #0:0: Video: ... 1080x1920"
    assert "1080x1920" in proc.stderr
