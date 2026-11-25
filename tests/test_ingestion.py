import pytest
from backend.downloader import VideoDownloader
from backend.transcriber import VideoTranscriber

def test_url_validation():
    assert VideoDownloader.is_valid_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert VideoDownloader.is_valid_youtube_url("https://www.youtube.com/watch?si=abc123&v=UF8uR6Z6KLc&t=45s")
    assert VideoDownloader.is_valid_youtube_url("https://youtu.be/dQw4w9WgXcQ?si=share")
    assert VideoDownloader.is_valid_youtube_url("https://youtube.com/shorts/dQw4w9WgXcQ")
    assert VideoDownloader.is_valid_youtube_url("demo://sample-podcast")
    assert VideoDownloader.is_valid_youtube_url("local://podcast.mp4")
    assert not VideoDownloader.is_valid_youtube_url("not-a-url")

def test_get_video_info_demo():
    downloader = VideoDownloader()
    info = downloader.get_video_info("demo://creator-podcast")
    assert info["id"] == "demo_podcast_01"
    assert "title" in info
    assert info["duration"] > 0
    assert info["channel"]

def test_transcriber_demo():
    transcriber = VideoTranscriber()
    transcript = transcriber.get_transcript("demo://sample-video")
    assert len(transcript) > 0
    first = transcript[0]
    assert "start" in first
    assert "end" in first
    assert "text" in first
    assert "words" in first
    assert len(first["words"]) > 0
