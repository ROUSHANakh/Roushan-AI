import os
from pathlib import Path

from dotenv import load_dotenv


# Support either backend/.env or project-root .env without hardcoding secrets in code.
_backend_env = Path(__file__).resolve().parent / ".env"
_root_env = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_backend_env)
load_dotenv(_root_env)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SEARCH_API_KEY = os.getenv("SEARCH_API_KEY", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")