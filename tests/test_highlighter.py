import pytest
from backend.highlighter import ClipHighlighter
from backend.transcriber import VideoTranscriber

def test_highlighter_finds_10_plus_clips():
    transcriber = VideoTranscriber()
    segments = transcriber.get_transcript("demo://sample-video")
    
    highlighter = ClipHighlighter(target_duration=45, min_duration=15, max_duration=75)
    clips = highlighter.find_highlights(segments, max_clips=12)

    assert len(clips) >= 10, f"Expected >= 10 clips, got {len(clips)}"
    for clip in clips:
        assert "start_time" in clip
        assert "end_time" in clip
        assert "duration" in clip
        assert clip["duration"] >= 15
        assert clip["score"] >= 70
        assert "category" in clip
        assert "hook_title" in clip
        assert "hook_quote" in clip
        assert "youtube_shorts_seo" in clip
        assert len(clip["hashtags"]) > 0

def test_highlighter_scores_strong_hooks_higher():
    highlighter = ClipHighlighter()
    high_hook_text = "The number one reason 99% of people fail is simple:"
    low_hook_text = "Today we are sitting here in this room talking about various things."
    
    high_score, _ = highlighter._evaluate_hook(high_hook_text)
    low_score, _ = highlighter._evaluate_hook(low_hook_text)
    
    assert high_score > low_score
