import sys
import uvicorn
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

if __name__ == "__main__":
    print("\n=======================================================")
    print("   Klipnux -- AI Video Clip & AutoCut Studio")
    print("   Running locally on: http://localhost:8000")
    print("   Open this URL in your browser to start clipping!")
    print("=======================================================\n")
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=False)
