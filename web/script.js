const promptEl = document.getElementById("prompt");
const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");
const orbEl = document.getElementById("orb");
const composerEl = document.getElementById("composer");

const micBtn = document.getElementById("micBtn");
const speakBtn = document.getElementById("speakBtn");

const API_BASE = "roushan-ai-production.up.railway.app";
const WAKE_WORD = "baba";
const WAKE_CONFIRMATION = "Yes Roushan Sir, I am here for your help.";

let lastReply = "";
let isListening = false;
let recognition = null;

function setStatus(message) {
  statusEl.textContent = message;
}

function setOrbState({ listening = false, speaking = false, wake = false } = {}) {
  orbEl.classList.toggle("listening", listening);
  orbEl.classList.toggle("speaking", speaking);
  orbEl.classList.toggle("wake", wake);
  orbEl.textContent = speaking ? "🗣️" : wake ? "⚡" : listening ? "🧠" : "🤖";
}

function triggerWakeReaction() {
  setOrbState({ listening: isListening, speaking: false, wake: true });
  setTimeout(() => {
    setOrbState({ listening: isListening, speaking: false, wake: false });
  }, 500);
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function speakText(text) {
  if (!text) return;

  setOrbState({ listening: isListening, speaking: true });
  setStatus("Generating BABA voice...");

  try {
    const response = await fetch(`${API_BASE}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.audio_base64) {
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`);
      await audio.play();
    } else if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 0.75;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }

    setStatus("Response spoken.");
  } catch (error) {
    setStatus("Voice request failed. Check ElevenLabs key.");
    console.error(error);
  } finally {
    setOrbState({ listening: isListening, speaking: false });
  }
}

async function sendMessage(rawText) {
  const message = rawText.trim();
  if (!message) return;

  promptEl.value = "";
  addMessage("user", message);
  setStatus("BABA is thinking...");

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, use_search: true }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    lastReply = data.reply || "No answer returned.";
    addMessage("assistant", lastReply);
    await speakText(lastReply);
  } catch (error) {
    addMessage("assistant", "I could not contact the backend. Start FastAPI and try again.");
    setStatus("Backend request failed.");
    console.error(error);
  }
}

async function confirmWakeWord() {
  triggerWakeReaction();
  addMessage("assistant", WAKE_CONFIRMATION);
  setStatus("Wake word detected.");
  await speakText(WAKE_CONFIRMATION);
}

function stopMic() {
  if (!recognition) return;
  recognition.stop();
  isListening = false;
  micBtn.textContent = "Start Mic";
  setOrbState({ listening: false, speaking: false });
  setStatus("Listening stopped.");
}

function startMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("Speech recognition is not supported in this browser.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    micBtn.textContent = "Stop Mic";
    setOrbState({ listening: true, speaking: false });
    setStatus('Listening for wake word "baba"...');
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    const lower = transcript.toLowerCase();
    if (!lower.includes(WAKE_WORD)) {
      setStatus(`Heard: "${transcript}". Waiting for wake word.`);
      return;
    }

    const command = lower.split(WAKE_WORD).slice(1).join(" ").trim();
    if (!command) {
      await confirmWakeWord();
      return;
    }

    triggerWakeReaction();
    setStatus(`Wake word detected. Executing: "${command}"`);
    await sendMessage(command);
  };

  recognition.onerror = () => {
    setStatus("Microphone error. Restart listening.");
    stopMic();
  };

  recognition.onend = () => {
    if (isListening) {
      isListening = false;
      micBtn.textContent = "Start Mic";
      setOrbState({ listening: false, speaking: false });
    }
  };

  recognition.start();
}

composerEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage(promptEl.value);
});

micBtn.addEventListener("click", () => {
  if (isListening) {
    stopMic();
  } else {
    startMic();
  }
});

speakBtn.addEventListener("click", async () => {
  if (!lastReply) {
    setStatus("No reply to speak yet.");
    return;
  }
  await speakText(lastReply);
});

addMessage("assistant", "BABA online. Say 'baba' then your command.");
