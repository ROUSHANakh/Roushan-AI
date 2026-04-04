import { FormEvent, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  text: string;
};

type OrbState = "standby" | "wake" | "thinking" | "speaking";

type RecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: null | (() => void);
  onresult: null | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void | Promise<void>);
  onerror: null | (() => void);
  onend: null | (() => void);
  start: () => void;
  stop: () => void;
} | null;

declare global {
  interface Window {
    SpeechRecognition?: new () => NonNullable<RecognitionInstance>;
    webkitSpeechRecognition?: new () => NonNullable<RecognitionInstance>;
  }
}

const API_BASE = "/api";
const WAKE_WORD = "baba";
const WAKE_CONFIRMATION = "Yes Roushan Sir, I am here for your help.";

function App() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("System online. Awaiting wake word.");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>("standby");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "BABA core online. Say 'baba' and your command." },
  ]);

  const recognitionRef = useRef<RecognitionInstance>(null);
  const isStartingRef = useRef(false);

  const lastReply = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "assistant") return messages[i].text;
    }
    return "";
  }, [messages]);

  const addMessage = (role: ChatRole, text: string) => {
    setMessages((prev) => [...prev, { role, text }]);
  };

  const reactToWakeWord = () => {
    setOrbState("wake");
    setTimeout(() => {
      setOrbState((current) => (current === "wake" ? "standby" : current));
    }, 520);
  };

  const speakReply = async (text: string) => {
    if (!text.trim()) return;
    setIsSpeaking(true);
    setOrbState("speaking");
    setStatus("Generating BABA voice...");

    try {
      const response = await fetch(`${API_BASE}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as { audio_base64?: string };

      if (data.audio_base64) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`);
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
        });
      } else if ("speechSynthesis" in window) {
        await new Promise<void>((resolve) => {
          const utter = new SpeechSynthesisUtterance(text);
          utter.pitch = 0.75;
          utter.rate = 0.95;
          utter.onend = () => resolve();
          utter.onerror = () => resolve();
          window.speechSynthesis.speak(utter);
        });
      }

      setStatus("Response spoken.");
    } catch {
      setStatus("Voice playback failed. Check backend and ElevenLabs key.");
    } finally {
      setIsSpeaking(false);
      setOrbState("standby");
    }
  };

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message) return;

    addMessage("user", message);
    setPrompt("");
    setStatus("BABA is thinking...");
    setOrbState("thinking");

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, use_search: true }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as { reply?: string };
      const reply = data.reply?.trim() || "I did not get a valid response.";
      addMessage("assistant", reply);
      await speakReply(reply);
    } catch {
      addMessage("assistant", "I could not reach the backend. Start FastAPI and try again.");
      setStatus("Backend request failed.");
      setOrbState("standby");
    }
  };

  const confirmWakeWord = async () => {
    reactToWakeWord();
    addMessage("assistant", WAKE_CONFIRMATION);
    setStatus("Wake word detected.");
    await speakReply(WAKE_CONFIRMATION);
  };

  const startListening = () => {
    if (isStartingRef.current || isListening) return;

    const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionApi) {
      setStatus("Speech recognition is not available in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionApi();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    isStartingRef.current = true;

    recognition.onstart = () => {
      setIsListening(true);
      setOrbState("standby");
      setStatus("Listening for wake word: baba");
      isStartingRef.current = false;
    };

    recognition.onresult = async (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const result = event.results[event.results.length - 1]?.[0]?.transcript?.trim() ?? "";
      if (!result) return;

      const lowered = result.toLowerCase();
      if (!lowered.includes(WAKE_WORD)) {
        setStatus(`Heard: "${result}". Waiting for wake word.`);
        return;
      }

      const wakeMatch = result.match(/baba\s*(.*)/i);
      const command = wakeMatch?.[1]?.trim() ?? "";

      if (!command) {
        await confirmWakeWord();
        return;
      }

      reactToWakeWord();
      setStatus(`Wake word detected. Running: "${command}"`);
      await sendMessage(command);
    };

    recognition.onerror = () => {
      setStatus("Mic error. Restart listening.");
      setIsListening(false);
      setOrbState("standby");
      isStartingRef.current = false;
    };

    recognition.onend = () => {
      setIsListening(false);
      setOrbState("standby");
      isStartingRef.current = false;
    };

    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setOrbState("standby");
    setStatus("Listening stopped.");
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendMessage(prompt);
  };

  const orbLabel =
    orbState === "speaking"
      ? "VOICE OUTPUT"
      : orbState === "thinking"
        ? "PROCESSING"
        : orbState === "wake"
          ? "WAKEWORD DETECTED"
          : "SYSTEM STANDBY";

  const orbEmoji =
    orbState === "speaking" ? "🗣️" : orbState === "thinking" ? "🧠" : orbState === "wake" ? "⚡" : "🤖";

  return (
    <main className="baba-screen">
      <div className="hud-grid" />

      <section className="hud-shell">
        <header className="hud-topbar">
          <p className="hud-brand">BABA_OS v1.0</p>
          <div className="hud-top-right">
            <p>
              STATUS: <span>{isListening ? "ACTIVE" : "IDLE"}</span>
            </p>
            <p>WEB_LINK</p>
            <p>AUDIO_OUT</p>
          </div>
        </header>

        <div className="hud-main">
          <aside className="core-panel">
            <div className={`core-orb ${orbState} ${isListening ? "listening" : ""} ${isSpeaking ? "speaking" : ""}`}>
              <div className="ring ring-1" />
              <div className="ring ring-2" />
              <div className="ring ring-3" />
              <div className="emoji-core" aria-live="polite">
                {orbEmoji}
              </div>
            </div>
            <p className="core-label">{orbLabel}</p>
          </aside>

          <section className="console-panel">
            <div className="log-window">
              <p className="sys-line">BABA_CORE</p>
              <p className="status-line">{status}</p>

              <div className="mt-6 space-y-3">
                {messages.map((msg, idx) => (
                  <div key={`${msg.role}-${idx}`} className={`message-line ${msg.role === "user" ? "user" : "assistant"}`}>
                    <span className={`message-role ${msg.role === "user" ? "user" : "assistant"}`}>
                      {msg.role === "user" ? "YOU" : "BABA"}
                    </span>
                    <span className="message-text">{msg.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={onSubmit} className="command-bar">
              <span className="command-prefix">&gt;</span>
              <input
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="ENTER COMMAND..."
                className="command-input"
              />
              <button type="button" onClick={isListening ? stopListening : startListening} className="command-button">
                {isListening ? "STOP MIC" : "MIC"}
              </button>
              <button type="submit" className="command-button">
                SEND
              </button>
              <button type="button" onClick={() => speakReply(lastReply)} className="command-button">
                SPEAK
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}

export default App;
