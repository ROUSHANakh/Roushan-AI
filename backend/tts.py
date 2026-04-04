import base64

import requests

from config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID


def synthesize_voice(text: str) -> str:
    if not text.strip() or not ELEVENLABS_API_KEY:
        return ""

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.75},
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
    except requests.RequestException:
        return ""

    return base64.b64encode(response.content).decode("utf-8")