import re

with open('backend/highlighter.py', encoding='utf-8') as f:
    content = f.read()

# Remove emojis from the emoji list that generates hook titles
# Replace the entire title generation section to remove emoji from title
# Pattern: lines 383-387 (emoji list + emoji used in title)

# Fix 1: Remove emoji list and don't use it in title
old_title_block = '''        emojis = ["\U0001F525", "\U0001F6A8", "\U0001F92F", "\u26A1", "\U0001F4A1", "\U0001F6D1", "\U0001F3AC", "\U0001F680", "\U0001F3AF", "\U0001F451"]
        emoji = emojis[index % len(emojis)]

        clean_hook = re.sub(r"[\\'\\"]", "", short_hook)
        title = f"{clean_hook} {emoji}"'''

new_title_block = '''        clean_hook = re.sub(r"[\\'\\"]", "", short_hook)
        title = clean_hook'''

# Fix 2: Remove emoji from shorts description
old_desc = '''"\\U0001F449 Follow for daily high-retention clips!\\n#shorts #viral #reels #podcast"'''
new_desc = '''"Follow for daily high-retention clips!\\n#shorts #viral #reels #podcast"'''

if old_title_block in content:
    content = content.replace(old_title_block, new_title_block)
    print("Fixed emoji title block")
else:
    print("Title block not found with exact match - using regex")
    # Try with regex
    content = re.sub(
        r'        emojis = \[.*?\]\n        emoji = emojis\[index % len\(emojis\)\]\n\n        clean_hook = re\.sub\(r"\[\\\'\\"\]", "", short_hook\)\n        title = f"\{clean_hook\} \{emoji\}"',
        '        clean_hook = re.sub(r"[\\\'\\""]", "", short_hook)\n        title = clean_hook',
        content,
        flags=re.DOTALL
    )

# Remove the 👉 from shorts_desc
content = content.replace('\U0001F449 Follow for daily high-retention clips!', 'Follow for daily high-retention clips!')

with open('backend/highlighter.py', 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
emoji_pattern = re.compile(r'[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F600-\U0001F64F\U0001F900-\U0001F9FF]')
remaining = emoji_pattern.findall(content)
if remaining:
    print(f"Still has emojis: {remaining[:10]}")
    # Show context
    for m in emoji_pattern.finditer(content):
        lineno = content[:m.start()].count('\n') + 1
        print(f"  Line {lineno}: {content.splitlines()[lineno-1][:100]}")
else:
    print("highlighter.py: ALL EMOJIS REMOVED - CLEAN")
