import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import {
  ChatMessage,
  OPENROUTER_MODELS,
  DEFAULT_MODEL,
  chatWithAI,
} from "../../services/openRouterService";
import { freeSpeak } from "../../utils/freeSpeak";
import "../../styles/aiConversation.css";

const VOICE_LANGS = [
  { code: "en-US", label: "English" },
  { code: "he-IL", label: "Hebrew" },
  { code: "ar-SA", label: "Arabic" },
  { code: "ru-RU", label: "Russian" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "zh-CN", label: "Chinese" },
];

const LS_KEY = "ai_conversation_api_key";
const ENV_API_KEY = process.env.REACT_APP_OPENAI_API_KEY || "";

const AiConversation: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    process.env.REACT_APP_OPENROUTER_DEFAULT_MODEL || DEFAULT_MODEL
  );
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful, concise assistant."
  );
  const [showSettings, setShowSettings] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voiceLang, setVoiceLang] = useState("en-US");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // API key override stored in localStorage
  const [uiApiKey, setUiApiKey] = useState<string>(
    () => localStorage.getItem(LS_KEY) || ""
  );
  const [keyInput, setKeyInput] = useState<string>(
    () => localStorage.getItem(LS_KEY) || ""
  );
  const [showKeyText, setShowKeyText] = useState(false);

  const effectiveKey = uiApiKey || ENV_API_KEY;

  const saveKey = useCallback((value: string) => {
    const trimmed = value.trim();
    setUiApiKey(trimmed);
    setKeyInput(trimmed);
    if (trimmed) {
      localStorage.setItem(LS_KEY, trimmed);
    } else {
      localStorage.removeItem(LS_KEY);
    }
  }, []);

  const clearKey = useCallback(() => {
    saveKey("");
  }, [saveKey]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    transcript,
    interimTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) setInputText(transcript);
  }, [transcript]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const toggleListening = useCallback(() => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      setInputText("");
      SpeechRecognition.startListening({
        language: voiceLang,
        interimResults: true,
        continuous: false,
      });
    }
  }, [listening, resetTranscript, voiceLang]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (listening) SpeechRecognition.stopListening();
    resetTranscript();
    setInputText("");
    setError("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const history: ChatMessage[] = [...messages, userMsg];
    setMessages(history);
    setIsLoading(true);

    try {
      const context: ChatMessage[] = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...history]
        : history;

      const reply = await chatWithAI(context, selectedModel, effectiveKey);
      const assistantMsg: ChatMessage = { role: "assistant", content: reply };
      setMessages((prev) => [...prev, assistantMsg]);

      if (ttsEnabled) {
        setIsSpeaking(true);
        await freeSpeak(reply, voiceLang).catch(console.error);
        setIsSpeaking(false);
      }
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [
    inputText,
    isLoading,
    listening,
    messages,
    resetTranscript,
    selectedModel,
    systemPrompt,
    ttsEnabled,
    voiceLang,
    effectiveKey,
  ]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError("");
    setInputText("");
    resetTranscript();
  };

  const isInterim = listening && !!interimTranscript;
  const keySource = uiApiKey ? "ui" : ENV_API_KEY ? "env" : "none";

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="ai-conversation">
        <p style={{ color: "#e94560", padding: 20 }}>
          Your browser does not support speech recognition. You can still type
          messages below.
        </p>
      </div>
    );
  }

  return (
    <div className="ai-conversation">
      {/* ── top bar ── */}
      <div className="ai-top-bar">
        <h2>AI Conversation</h2>
        <select
          className="ai-model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          {OPENROUTER_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          className="ai-settings-btn"
          onClick={() => setShowSettings((p) => !p)}
        >
          {showSettings ? "▲ Settings" : "▼ Settings"}
        </button>
        {messages.length > 0 && (
          <button className="ai-clear-btn" onClick={clearConversation}>
            Clear
          </button>
        )}
        {isSpeaking && (
          <span style={{ fontSize: "0.78rem", color: "#4caf50" }}>
            🔊 speaking…
          </span>
        )}
      </div>

      {/* ── settings panel ── */}
      {showSettings && (
        <div className="ai-settings-panel">
          {/* API key override */}
          <label>OpenRouter API key</label>
          <div className="ai-key-row">
            <input
              className="ai-key-input"
              type={showKeyText ? "text" : "password"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={
                ENV_API_KEY
                  ? "Leave blank to use env key"
                  : "Paste your OpenRouter key…"
              }
              spellCheck={false}
              autoComplete="off"
            />
            <button
              className="ai-key-toggle"
              onClick={() => setShowKeyText((p) => !p)}
              title={showKeyText ? "Hide key" : "Show key"}
            >
              {showKeyText ? "🙈" : "👁"}
            </button>
            <button
              className="ai-key-save"
              onClick={() => saveKey(keyInput)}
              disabled={keyInput === uiApiKey}
            >
              Save
            </button>
            {uiApiKey && (
              <button className="ai-key-clear" onClick={clearKey}>
                ✕ Clear
              </button>
            )}
          </div>
          <p className="ai-key-status">
            {keySource === "ui" && (
              <span style={{ color: "#4caf50" }}>✔ Using key from UI (overrides env)</span>
            )}
            {keySource === "env" && (
              <span style={{ color: "#aaa" }}>Using key from REACT_APP_OPENAI_API_KEY env var</span>
            )}
            {keySource === "none" && (
              <span style={{ color: "#e94560" }}>
                ⚠ No API key — enter one above or set REACT_APP_OPENAI_API_KEY in Replit Secrets
              </span>
            )}
          </p>

          {/* System prompt */}
          <label style={{ marginTop: 10 }}>System prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g. You are a helpful assistant."
          />

          {/* TTS + voice lang */}
          <div className="ai-settings-row">
            <label>
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
              />
              Read replies aloud (TTS)
            </label>
            <label>
              Voice / TTS language:
              <select
                className="ai-lang-select"
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
                style={{ marginLeft: 6 }}
              >
                {VOICE_LANGS.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* ── messages ── */}
      <div className="ai-messages">
        {messages.length === 0 && !isLoading && (
          <div className="ai-empty">
            <p>Start a conversation.</p>
            <p>
              Type a message or press 🎤 to speak.
              <br />
              <span style={{ fontSize: "0.8rem" }}>
                Shift+Enter for a new line · Enter to send
              </span>
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role}`}>
            <span className="ai-message-role">
              {msg.role === "user" ? "You" : "AI"}
            </span>
            <div className="ai-message-bubble">{msg.content}</div>
          </div>
        ))}

        {isLoading && <div className="ai-thinking">Thinking…</div>}

        {error && <div className="ai-error">⚠ {error}</div>}

        <div ref={messagesEndRef} />
      </div>

      {/* ── input bar ── */}
      <div className="ai-input-bar">
        <button
          className={`ai-mic-btn${listening ? " listening" : ""}`}
          onClick={toggleListening}
          title={listening ? "Stop recording" : "Start recording"}
        >
          🎤
        </button>

        <textarea
          ref={textareaRef}
          className={isInterim ? "interim" : ""}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            listening ? "Listening…" : "Type a message or press 🎤 to speak…"
          }
          rows={1}
        />

        <button
          className="ai-send-btn"
          onClick={sendMessage}
          disabled={!inputText.trim() || isLoading}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default React.memo(AiConversation);
