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
  checkServerKey,
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

const LS_KEY_API   = "ai_conversation_api_key";
const LS_KEY_MODEL = "ai_conversation_model";

const lsGet = (key: string, fallback: string) =>
  localStorage.getItem(key) || fallback;
const lsSet = (key: string, value: string) => {
  if (value) localStorage.setItem(key, value);
  else        localStorage.removeItem(key);
};

const AiConversation: React.FC = () => {
  // ── conversation ───────────────────────────────────────────────────────────
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [inputText,  setInputText]  = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ── OpenRouter inputs (persisted) ──────────────────────────────────────────
  const [modelInput,  setModelInput]  = useState(() => lsGet(LS_KEY_MODEL, DEFAULT_MODEL));
  const [activeModel, setActiveModel] = useState(() => lsGet(LS_KEY_MODEL, DEFAULT_MODEL));

  const [uiApiKey,    setUiApiKey]    = useState(() => lsGet(LS_KEY_API, ""));
  const [activeApiKey,setActiveApiKey]= useState(() => lsGet(LS_KEY_API, ""));
  const [showKey,     setShowKey]     = useState(false);

  // whether the server itself has a key configured
  const [serverHasKey, setServerHasKey] = useState<boolean | null>(null);

  // ── settings ───────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful, concise assistant.");
  const [ttsEnabled,   setTtsEnabled]   = useState(true);
  const [voiceLang,    setVoiceLang]    = useState("en-US");

  // ── refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  // ── speech recognition ────────────────────────────────────────────────────
  const {
    transcript, interimTranscript, listening,
    resetTranscript, browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // ── effects ────────────────────────────────────────────────────────────────
  useEffect(() => { if (transcript) setInputText(transcript); }, [transcript]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  // probe server for key on mount
  useEffect(() => {
    checkServerKey().then(setServerHasKey);
  }, []);

  // ── model helpers ──────────────────────────────────────────────────────────
  const commitModel = useCallback((val: string) => {
    const v = val.trim() || DEFAULT_MODEL;
    setModelInput(v);
    setActiveModel(v);
    lsSet(LS_KEY_MODEL, v);
  }, []);

  // ── api-key helpers ────────────────────────────────────────────────────────
  const commitApiKey = useCallback((val: string) => {
    const v = val.trim();
    setUiApiKey(v);
    setActiveApiKey(v);
    lsSet(LS_KEY_API, v);
  }, []);

  const clearApiKey = useCallback(() => commitApiKey(""), [commitApiKey]);

  // ── send ───────────────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      setInputText("");
      SpeechRecognition.startListening({ language: voiceLang, interimResults: true, continuous: false });
    }
  }, [listening, resetTranscript, voiceLang]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    if (listening) SpeechRecognition.stopListening();
    resetTranscript();
    setInputText("");
    setError("");

    const userMsg: ChatMessage  = { role: "user", content: text };
    const history: ChatMessage[] = [...messages, userMsg];
    setMessages(history);
    setIsLoading(true);

    try {
      const context = systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }, ...history]
        : history;

      // Only send UI key if user explicitly set one; server falls back to its env key.
      const reply = await chatWithAI(context, activeModel, activeApiKey || undefined);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

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
    inputText, isLoading, listening, messages, resetTranscript,
    activeModel, activeApiKey, systemPrompt, ttsEnabled, voiceLang,
  ]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearConversation = () => {
    setMessages([]); setError(""); setInputText(""); resetTranscript();
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const isInterim   = listening && !!interimTranscript;
  const modelDirty  = modelInput !== activeModel;
  const keyDirty    = uiApiKey   !== activeApiKey;

  // key status: ui-set > server-has-key > unknown/none
  const keyStatus: "ui" | "server" | "none" | "checking" =
    activeApiKey ? "ui"
    : serverHasKey === null ? "checking"
    : serverHasKey ? "server"
    : "none";

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="ai-conversation">
        <p style={{ color: "#e94560", padding: 20 }}>
          Your browser does not support speech recognition. You can still type messages below.
        </p>
      </div>
    );
  }

  return (
    <div className="ai-conversation">

      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <div className="ai-top-bar">
        <h2>AI Conversation</h2>

        <div className="ai-model-wrap">
          <input
            className="ai-model-input"
            list="or-models"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onBlur={(e)  => commitModel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitModel((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="model id…"
            spellCheck={false}
            autoComplete="off"
            title="Type any OpenRouter model ID, or pick from the list"
          />
          <datalist id="or-models">
            {OPENROUTER_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </datalist>
          {modelDirty && (
            <button className="ai-model-apply" onClick={() => commitModel(modelInput)} title="Apply model">✓</button>
          )}
        </div>

        <button className="ai-settings-btn" onClick={() => setShowSettings((p) => !p)}>
          {showSettings ? "▲ Settings" : "▼ Settings"}
        </button>
        {messages.length > 0 && (
          <button className="ai-clear-btn" onClick={clearConversation}>Clear</button>
        )}
        {isSpeaking && <span className="ai-speaking-badge">🔊 speaking…</span>}
      </div>

      {/* ── OpenRouter inputs bar ────────────────────────────────────────── */}
      <div className="ai-or-bar">

        {/* API key */}
        <div className="ai-or-field">
          <span className="ai-or-label">API key</span>
          <div className="ai-key-row">
            <input
              className="ai-key-input"
              type={showKey ? "text" : "password"}
              value={uiApiKey}
              onChange={(e) => setUiApiKey(e.target.value)}
              onBlur={(e)   => commitApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitApiKey((e.target as HTMLInputElement).value);
              }}
              placeholder={serverHasKey ? "server key active — paste to override" : "sk-or-…"}
              spellCheck={false}
              autoComplete="off"
            />
            <button className="ai-key-toggle" onClick={() => setShowKey((p) => !p)} title={showKey ? "Hide" : "Show"}>
              {showKey ? "🙈" : "👁"}
            </button>
            {keyDirty && (
              <button className="ai-key-save" onClick={() => commitApiKey(uiApiKey)}>Save</button>
            )}
            {activeApiKey && (
              <button className="ai-key-clear" onClick={clearApiKey} title="Remove override">✕</button>
            )}
          </div>
          <span className="ai-or-hint">
            {keyStatus === "checking" && <span style={{ color: "#888" }}>Checking server…</span>}
            {keyStatus === "ui"       && <span style={{ color: "#4caf50" }}>✔ UI key → sent to server</span>}
            {keyStatus === "server"   && <span style={{ color: "#888" }}>Server key active (OPENROUTER_API_KEY)</span>}
            {keyStatus === "none"     && <span style={{ color: "#e94560" }}>⚠ No key — enter one above or set OPENROUTER_API_KEY on the server</span>}
          </span>
        </div>

        {/* Active model badge */}
        <div className="ai-or-field ai-or-model-info">
          <span className="ai-or-label">Active model</span>
          <span className="ai-or-model-badge" title={activeModel}>{activeModel}</span>
        </div>

      </div>

      {/* ── settings panel ──────────────────────────────────────────────── */}
      {showSettings && (
        <div className="ai-settings-panel">
          <label>System prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g. You are a helpful assistant."
          />
          <div className="ai-settings-row">
            <label>
              <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)} />
              Read replies aloud (TTS)
            </label>
            <label>
              Voice / TTS language:
              <select className="ai-lang-select" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)} style={{ marginLeft: 6 }}>
                {VOICE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* ── messages ────────────────────────────────────────────────────── */}
      <div className="ai-messages">
        {messages.length === 0 && !isLoading && (
          <div className="ai-empty">
            <p>Start a conversation.</p>
            <p>Type a message or press 🎤 to speak.<br />
              <span style={{ fontSize: "0.8rem" }}>Shift+Enter for a new line · Enter to send</span>
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role}`}>
            <span className="ai-message-role">{msg.role === "user" ? "You" : "AI"}</span>
            <div className="ai-message-bubble">{msg.content}</div>
          </div>
        ))}
        {isLoading && <div className="ai-thinking">Thinking…</div>}
        {error     && <div className="ai-error">⚠ {error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* ── input bar ───────────────────────────────────────────────────── */}
      <div className="ai-input-bar">
        <button
          className={`ai-mic-btn${listening ? " listening" : ""}`}
          onClick={toggleListening}
          title={listening ? "Stop recording" : "Start recording"}
        >🎤</button>
        <textarea
          ref={textareaRef}
          className={isInterim ? "interim" : ""}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "Listening…" : "Type a message or press 🎤 to speak…"}
          rows={1}
        />
        <button className="ai-send-btn" onClick={sendMessage} disabled={!inputText.trim() || isLoading} title="Send">➤</button>
      </div>

    </div>
  );
};

export default React.memo(AiConversation);
