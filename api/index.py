import os
import sys
import urllib.parse
from pathlib import Path

# Add workspace root to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

os.environ["VERCEL"] = "1"

from backend.server import app as fastapi_app

class VercelPathMiddleware:
    """
    Restores the original requested API path when rewritten by Vercel
    from /api/(.*) -> /api/index.py?__path__=$1.
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            query_bytes = scope.get("query_string", b"")
            query_str = query_bytes.decode("latin1")
            if "__path__=" in query_str:
                parsed = urllib.parse.parse_qs(query_str, keep_blank_values=True)
                if "__path__" in parsed:
                    sub_path = parsed.pop("__path__")[0].lstrip("/")
                    clean_path = f"/api/{sub_path}" if sub_path else "/api"
                    scope["path"] = clean_path
                    scope["raw_path"] = clean_path.encode("latin1")
                    clean_query = urllib.parse.urlencode([(k, v) for k, vs in parsed.items() for v in vs])
                    scope["query_string"] = clean_query.encode("latin1")
        await self.inner(scope, receive, send)

# IMPORTANT: Vercel's Python runtime prioritizes 'app' over 'handler',
# so 'app' MUST be the outer ASGI middleware!
app = VercelPathMiddleware(fastapi_app)
handler = app
