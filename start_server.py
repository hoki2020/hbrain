"""Start hbrain backend using uvicorn."""
import logging
import os
import sys

os.environ["NO_PROXY"] = "localhost,127.0.0.1"
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
os.environ.pop("HTTP_PROXY", None)
os.environ.pop("HTTPS_PROXY", None)
os.environ.pop("http_proxy", None)
os.environ.pop("https_proxy", None)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Configure logging so application loggers output to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(name)s - %(message)s",
    datefmt="%H:%M:%S",
    force=True,
)

from src.api.app import app
import uvicorn

if __name__ == "__main__":
    print("Starting hbrain backend on http://127.0.0.1:8000 ...", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
