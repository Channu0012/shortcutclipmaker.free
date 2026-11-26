from typing import Dict, Any

CAPTION_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "hormozi": {
        "id": "hormozi",
        "name": "Alex Hormozi",
        "description": "Bold white highlight on emerald pill backing for maximum readability",
        "font_family": "Archivo Black",
        "font_size": 68,
        "font_color": "#FFFFFF",
        "highlight_color": "#FFFFFF",      # High-contrast white inside pill
        "emphasis_color": "#FFE000",       # Punchy Gold
        "stroke_color": "#000000",
        "stroke_width": 5,
        "word_box": True,
        "word_box_color": "#00A648",       # Rich Emerald pill background
        "animation": "karaoke",
        "word_pop": True,
        "uppercase": True,
        "shadow": True,
        "glow": False,
        "max_words_per_line": 3,
        "position_y": 0.72,
    },
    "mrbeast": {
        "id": "mrbeast",
        "name": "MrBeast Pop",
        "description": "Large yellow text with red pop highlights & thick outline",
        "font_family": "Anton",
        "font_size": 74,
        "font_color": "#FFFF00",           # Yellow
        "highlight_color": "#FF2D2D",      # Red pop
        "emphasis_color": "#FFFFFF",
        "stroke_color": "#000000",
        "stroke_width": 6,
        "word_box": False,
        "word_box_color": None,
        "animation": "karaoke",
        "word_pop": True,
        "uppercase": True,
        "shadow": True,
        "glow": False,
        "max_words_per_line": 3,
        "position_y": 0.70,
    },
    "tiktok": {
        "id": "tiktok",
        "name": "TikTok Viral",
        "description": "Clean bold font with signature pink highlights",
        "font_family": "TikTok Sans",
        "font_size": 64,
        "font_color": "#FFFFFF",
        "highlight_color": "#FE2C55",      # TikTok Pink
        "emphasis_color": "#25F4EE",       # TikTok Cyan
        "stroke_color": "#000000",
        "stroke_width": 5,
        "word_box": False,
        "word_box_color": None,
        "animation": "karaoke",
        "word_pop": True,
        "uppercase": False,
        "shadow": True,
        "glow": False,
        "max_words_per_line": 4,
        "position_y": 0.74,
    },
    "neon": {
        "id": "neon",
        "name": "Cyber Neon",
        "description": "Glowing cyan & magenta outline with soft blur glow",
        "font_family": "THE BOLD FONT (FREE VERSION)",
        "font_size": 66,
        "font_color": "#00FFFF",           # Cyan
        "highlight_color": "#FF00FF",      # Magenta
        "emphasis_color": "#FFCC00",
        "stroke_color": "#002A6B",          # Deep Blue outline
        "stroke_width": 4,
        "word_box": False,
        "word_box_color": None,
        "animation": "karaoke",
        "word_pop": True,
        "uppercase": True,
        "shadow": False,
        "glow": True,
        "max_words_per_line": 4,
        "position_y": 0.73,
    },
    "minimal": {
        "id": "minimal",
        "name": "Minimalist Pro",
        "description": "Clean, understated subtitles with a dark backdrop box",
        "font_family": "Open Sans",
        "font_size": 52,
        "font_color": "#FFFFFF",
        "highlight_color": "#FFE000",
        "emphasis_color": None,
        "stroke_color": None,
        "stroke_width": 0,
        "word_box": False,
        "word_box_color": None,
        "background": True,
        "background_color": "#00000080",
        "animation": "fade",
        "word_pop": False,
        "uppercase": False,
        "shadow": False,
        "glow": False,
        "max_words_per_line": 5,
        "position_y": 0.80,
    },
    "podcast": {
        "id": "podcast",
        "name": "Deep Podcast",
        "description": "Warm gold highlights with balanced spacing for interviews",
        "font_family": "Poppins ExtraBold",
        "font_size": 60,
        "font_color": "#FFFFFF",
        "highlight_color": "#FFB800",      # Warm gold
        "emphasis_color": "#FF8C00",
        "stroke_color": "#1A1A1A",
        "stroke_width": 3,
        "word_box": False,
        "word_box_color": None,
        "animation": "karaoke",
        "word_pop": False,
        "uppercase": False,
        "shadow": True,
        "glow": False,
        "max_words_per_line": 4,
        "position_y": 0.78,
    }
}

def get_caption_template(template_name: str) -> Dict[str, Any]:
    return CAPTION_TEMPLATES.get(template_name.lower(), CAPTION_TEMPLATES["hormozi"])

def list_caption_templates() -> list:
    return [
        {
            "id": k,
            "name": v["name"],
            "description": v["description"],
            "font_family": v["font_family"],
            "font_color": v["font_color"],
            "highlight_color": v["highlight_color"],
            "sample": "THE SECRET TO 10X GROWTH" if v["uppercase"] else "The secret to 10x growth"
        }
        for k, v in CAPTION_TEMPLATES.items()
    ]
