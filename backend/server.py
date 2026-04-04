from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import OPENAI_API_KEY
from search import search_google
from tts import synthesize_voice

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - dependency controlled by requirements.txt
    OpenAI = None


app = FastAPI(title="BABA MVP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    use_search: bool = True


class ChatResponse(BaseModel):
    reply: str
    search_context: list[str]


class TTSRequest(BaseModel):
    text: str


PROMPT_PATH = Path(__file__).with_name("prompt.txt")
MASTER_PROMPT = PROMPT_PATH.read_text(encoding="utf-8")


def generate_reply(message: str, search_context: list[str]) -> str:
    if not OPENAI_API_KEY:
        return (
            "BABA backend is running, but OpenAI key is missing. "
            "Add OPENAI_API_KEY in backend/.env or project .env."
        )

    if OpenAI is None:
        return "OpenAI SDK is not installed. Run: pip install -r requirements.txt"

    client = OpenAI(api_key=OPENAI_API_KEY)

    context_block = "\n".join(f"- {item}" for item in search_context) if search_context else "No external context."
    prompt = (
        f"{MASTER_PROMPT}\n\n"
        f"User message:\n{message}\n\n"
        f"Real-time context:\n{context_block}\n"
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    context = search_google(payload.message) if payload.use_search else []
    reply = generate_reply(payload.message, context)
    return ChatResponse(reply=reply, search_context=context)


@app.post("/tts")
def text_to_speech(payload: TTSRequest) -> dict[str, str]:
    audio_b64 = synthesize_voice(payload.text)
    return {"audio_base64": audio_b64}
