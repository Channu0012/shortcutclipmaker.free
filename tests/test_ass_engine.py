import subprocess
from pathlib import Path
from backend.config import FFMPEG_PATH, FONTS_DIR, TEMP_DIR
from backend.caption_templates import get_caption_template

def hex_to_ass(hex_val: str) -> str:
    val = (hex_val or "#FFFFFF").strip().lstrip("#")
    if len(val) == 8:
        val = val[:6]
    elif len(val) != 6:
        val = "FFFFFF"
    r, g, b = val[0:2], val[2:4], val[4:6]
    return f"&H00{b}{g}{r}&"

def test_ass_ffmpeg():
    ass_path = TEMP_DIR / "test_engine.ass"
    out_mp4 = TEMP_DIR / "test_engine.mp4"
    
    tpl = get_caption_template("hormozi")
    primary = hex_to_ass(tpl["font_color"])
    highlight = hex_to_ass(tpl["highlight_color"])
    box_color = hex_to_ass(tpl.get("word_box_color", "#00BF49"))
    
    font_name = "THEBOLDFONT"
    font_size = tpl["font_size"]
    
    content = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary},&H000000FF&,&H00000000&,&H80000000&,1,0,0,0,100,100,0,0,1,4,2,2,40,40,360,1
Style: HookBanner,{font_name},44,{highlight},&H000000FF&,&H00000000&,&H90000000&,1,0,0,0,100,100,0,0,1,3,2,8,30,30,160,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 1,0:00:00.00,0:00:02.00,HookBanner,,0,0,0,,{{\\fad(150,200)}}HOW TO WIN BIG
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,{{\\c{highlight}\\3c{box_color}\\bord8}}THIS{{\\c{primary}\\3c&H00000000&\\bord4}} IS CRAZY
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{{\\c{primary}\\3c&H00000000&\\bord4}}THIS {{\\c{highlight}\\3c{box_color}\\bord8}}IS{{\\c{primary}\\3c&H00000000&\\bord4}} CRAZY
"""
    ass_path.write_text(content, encoding="utf-8")
    
    ass_escaped = str(ass_path.resolve()).replace('\\', '/').replace(':', '\\:')
    fonts_escaped = str(FONTS_DIR.resolve()).replace('\\', '/').replace(':', '\\:')
    
    cmd = [
        FFMPEG_PATH, "-y",
        "-f", "lavfi", "-i", "color=c=black:s=1080x1920:d=2",
        "-vf", f"ass='{ass_escaped}':fontsdir='{fonts_escaped}'",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        str(out_mp4)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    assert res.returncode == 0, f"FFmpeg failed: {res.stderr}"
    assert out_mp4.exists() and out_mp4.stat().st_size > 1000
    print("PASS: FFmpeg ASS rendering with fontsdir rendered successfully!", out_mp4.stat().st_size)

if __name__ == "__main__":
    test_ass_ffmpeg()
