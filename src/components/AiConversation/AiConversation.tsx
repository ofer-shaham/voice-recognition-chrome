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
const LS_KEY_WORDS = "ai_max_words";
const LS_KEY_MODE  = "ai_voice_mode";

const lsGet = (key: string, fallback: string) =>
  localStorage.getItem(key) || fallback;
const lsSet = (key: string, value: string) => {
  if (value) localStorage.setItem(key, value);
  else        localStorage.removeItem(key);
};

const API_BASE = process.env.REACT_APP_API_URL || "";

interface HealthSignal {
  timestamp: number;
  ok: boolean;
  age?: string;
  uptime?: number;
}

interface AiHealthResult {
  ok: boolean;
  elapsed?: number;
  error?: string;
  timestamp?: number;
}

interface FreeModel {
  id: string;
  label: string;
}

const AiConversation: React.FC = () => {
  // ── conversation ───────────────────────────────────────────────────────────
  const [messages,   setMessages]   = useState<ChatMessage[]>([]);
  const [inputText,  setInputText]  = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [error,      setError]      = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ── model ──────────────────────────────────────────────────────────────────
  const [modelInput,  setModelInput]  = useState(() => lsGet(LS_KEY_MODEL, DEFAULT_MODEL));
  const [activeModel, setActiveModel] = useState(() => lsGet(LS_KEY_MODEL, DEFAULT_MODEL));
  const [freeModels,  setFreeModels]  = useState<FreeModel[]>([]);

  // ── api key ────────────────────────────────────────────────────────────────
  const [uiApiKey,     setUiApiKey]     = useState(() => lsGet(LS_KEY_API, ""));
  const [activeApiKey, setActiveApiKey] = useState(() => lsGet(LS_KEY_API, ""));
  const [showKey,      setShowKey]      = useState(false);
  const [serverHasKey, setServerHasKey] = useState<boolean | null>(null);

  // ── settings ───────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful, concise assistant.");
  const [ttsEnabled,   setTtsEnabled]   = useState(true);
  const [voiceLang,    setVoiceLang]    = useState("en-US");
  const [maxWords,     setMaxWords]     = useState<number>(() =>
    parseInt(lsGet(LS_KEY_WORDS, "12"), 10));
  const [voiceMode,    setVoiceMode]    = useState<"manual" | "auto">(() =>
    lsGet(LS_KEY_MODE, "manual") as "manual" | "auto");

  // ── server health indicator ────────────────────────────────────────────────
  const [healthSignals,   setHealthSignals]   = useState<HealthSignal[]>([]);
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const [serverAlive,     setServerAlive]     = useState<boolean | null>(null);

  // ── ai health ─────────────────────────────────────────────────────────────
  const [aiHealthResult,  setAiHealthResult]  = useState<AiHealthResult | null>(null);
  const [aiHealthLoading, setAiHealthLoading] = useState(false);

  // ── refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const prevListeningRef = useRef(false);
  const isLoadingRef     = useRef(isLoading);
  const isSpeakingRef    = useRef(isSpeaking);
  const voiceModeRef     = useRef(voiceMode);
  const voiceLangRef     = useRef(voiceLang);
  useEffect(() => { isLoadingRef.current  = isLoading;  }, [isLoading]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { voiceModeRef.current  = voiceMode;  }, [voiceMode]);
  useEffect(() => { voiceLangRef.current  = voiceLang;  }, [voiceLang]);

  // ── speech recognition ────────────────────────────────────────────────────
  const {
    transcript, interimTranscript, listening,
    resetTranscript, browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // ── effects ────────────────────────────────────────────────────────────────
  useEffect(() => { if (transcript) setInputText(transcript); }, [transcript]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
  useEffect(() => {
    checkServerKey().then(setServerHasKey);
  }, []);

  // ── server health polling ─────────────────────────────────────────────────
  const pingHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        const signal: HealthSignal = { timestamp: data.timestamp ?? Date.now(), ok: true, age: data.age, uptime: data.uptime };
        setHealthSignals((prev) => [signal, ...prev].slice(0, 20));
        setServerAlive(true);
      } else {
        setHealthSignals((prev) => [{ timestamp: Date.now(), ok: false }, ...prev].slice(0, 20));
        setServerAlive(false);
      }
    } catch {
      setHealthSignals((prev) => [{ timestamp: Date.now(), ok: false }, ...prev].slice(0, 20));
      setServerAlive(false);
    }
  }, []);

  useEffect(() => {
    pingHealth();
    const id = setInterval(pingHealth, 15000);
    return () => clearInterval(id);
  }, [pingHealth]);

  // ── fetch free models ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/free-models`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.models?.length) setFreeModels(data.models);
      })
      .catch(() => {});
  }, []);

  // ── ai health ping ────────────────────────────────────────────────────────
  const pingAiHealth = useCallback(async () => {
    setAiHealthLoading(true);
    setAiHealthResult(null);
    try {
      const body: Record<string, string> = {};
      if (activeApiKey) body.apiKey = activeApiKey;
      const res = await fetch(`${API_BASE}/api/health_ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setAiHealthResult(data);
    } catch (e: any) {
      setAiHealthResult({ ok: false, error: e.message, timestamp: Date.now() });
    } finally {
      setAiHealthLoading(false);
    }
  }, [activeApiKey]);

  // ── helpers ────────────────────────────────────────────────────────────────
  const commitModel = useCallback((val: string) => {
    const v = val.trim() || DEFAULT_MODEL;
    setModelInput(v);
    setActiveModel(v);
    lsSet(LS_KEY_MODEL, v);
  }, []);

  const commitApiKey = useCallback((val: string) => {
    const v = val.trim();
    setUiApiKey(v);
    setActiveApiKey(v);
    lsSet(LS_KEY_API, v);
  }, []);

  const clearApiKey = useCallback(() => commitApiKey(""), [commitApiKey]);

  const handleMaxWordsChange = (val: number) => {
    setMaxWords(val);
    lsSet(LS_KEY_WORDS, String(val));
  };

  const handleVoiceModeChange = (mode: "manual" | "auto") => {
    setVoiceMode(mode);
    lsSet(LS_KEY_MODE, mode);
  };

  // ── start listening helper ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    resetTranscript();
    setInputText("");
    SpeechRecognition.startListening({
      language: voiceLangRef.current,
      interimResults: true,
      continuous: false,
    });
  }, [resetTranscript]);

  // ── mic toggle ────────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening]);

  // ── core send ─────────────────────────────────────────────────────────────
  const sendWithText = useCallback(async (
    text: string,
    currentMessages: ChatMessage[],
    model: string,
    apiKey: string,
    prompt: string,
    tts: boolean,
    lang: string,
    words: number,
  ) => {
    if (!text || isLoadingRef.current) return;

    resetTranscript();
    setInputText("");
    setError("");

    const userMsg: ChatMessage   = { role: "user", content: text };
    const history: ChatMessage[] = [...currentMessages, userMsg];
    setMessages(history);
    setIsLoading(true);

    try {
      const wordInstruction = `Reply in ${words} words or fewer.`;
      const fullPrompt      = prompt ? `${prompt}\n${wordInstruction}` : wordInstruction;

      const context: ChatMessage[] = [
        { role: "system", content: fullPrompt },
        ...history,
      ];

      const maxTokens = Math.ceil(words * 2);
      const reply = await chatWithAI(context, model, apiKey || undefined, maxTokens);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);

      if (tts) {
        setIsSpeaking(true);
        await freeSpeak(reply, lang).catch(console.error);
        setIsSpeaking(false);
      }

      if (voiceModeRef.current === "auto") {
        setTimeout(() => startListening(), 300);
      }
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [resetTranscript, startListening]);

  // ── ref copies to avoid stale closures ───────────────────────────────────
  const messagesRef     = useRef(messages);
  const activeModelRef  = useRef(activeModel);
  const activeApiKeyRef = useRef(activeApiKey);
  const systemPromptRef = useRef(systemPrompt);
  const ttsEnabledRef   = useRef(ttsEnabled);
  const maxWordsRef     = useRef(maxWords);
  useEffect(() => { messagesRef.current     = messages;     }, [messages]);
  useEffect(() => { activeModelRef.current  = activeModel;  }, [activeModel]);
  useEffect(() => { activeApiKeyRef.current = activeApiKey; }, [activeApiKey]);
  useEffect(() => { systemPromptRef.current = systemPrompt; }, [systemPrompt]);
  useEffect(() => { ttsEnabledRef.current   = ttsEnabled;   }, [ttsEnabled]);
  useEffect(() => { maxWordsRef.current     = maxWords;     }, [maxWords]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || isLoadingRef.current) return;
    if (listening) SpeechRecognition.stopListening();
    sendWithText(
      text,
      messagesRef.current,
      activeModelRef.current,
      activeApiKeyRef.current,
      systemPromptRef.current,
      ttsEnabledRef.current,
      voiceLangRef.current,
      maxWordsRef.current,
    );
  }, [inputText, listening, sendWithText]);

  // ── auto mode: send when mic stops ───────────────────────────────────────
  useEffect(() => {
    const wasListening = prevListeningRef.current;
    prevListeningRef.current = listening;

    if (
      voiceModeRef.current === "auto" &&
      wasListening && !listening &&
      !isLoadingRef.current && !isSpeakingRef.current
    ) {
      const text = transcript.trim();
      if (text) {
        setTimeout(() => {
          sendWithText(
            text,
            messagesRef.current,
            activeModelRef.current,
            activeApiKeyRef.current,
            systemPromptRef.current,
            ttsEnabledRef.current,
            voiceLangRef.current,
            maxWordsRef.current,
          );
        }, 150);
      }
    }
  }, [listening, transcript, sendWithText]);

  useEffect(() => {
    if (voiceMode === "auto" && !listening && !isLoading && !isSpeaking) {
      setTimeout(() => startListening(), 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearConversation = () => {
    setMessages([]); setError(""); setInputText(""); resetTranscript();
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const isInterim  = listening && !!interimTranscript;
  const modelDirty = modelInput !== activeModel;
  const keyDirty   = uiApiKey   !== activeApiKey;

  const keyStatus: "ui" | "server" | "none" | "checking" =
    activeApiKey ? "ui"
    : serverHasKey === null ? "checking"
    : serverHasKey ? "server"
    : "none";

  // merged model list: free models from server + static fallback, deduplicated
  const allModels: FreeModel[] = React.useMemo(() => {
    const base = freeModels.length ? freeModels : OPENROUTER_MODELS;
    const seen  = new Set(base.map((m) => m.id));
    const extra = OPENROUTER_MODELS.filter((m) => !seen.has(m.id));
    return [...base, ...extra];
  }, [freeModels]);

  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="ai-conversation">
        <p style={{ color: "#e94560", padding: 20 }}>
          Your browser does not support speech recognition. You can still type messages below.
        </p>
      </div>
    );
  }

  const healthDotClass =
    serverAlive === null ? "health-dot checking" :
    serverAlive           ? "health-dot alive"   :
                            "health-dot dead";

  return (
    <div className="ai-conversation">

      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <div className="ai-top-bar">
        <h2>AI Conversation</h2>

        {/* server health dot */}
        <button
          className="ai-health-btn"
          onClick={() => { setShowHealthPanel((p) => !p); pingHealth(); }}
          title="Server health — click to see signals"
        >
          <span className={healthDotClass} />
        </button>

        <div className="ai-model-wrap">
          <input
            className="ai-model-input"
            list="or-models"
            value={modelInput}
            onChange={(e) => setModelInput(e.target.value)}
            onBlur={(e)   => commitModel(e.target.value)}
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
            {allModels.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </datalist>
          {modelDirty && (
            <button className="ai-model-apply" onClick={() => commitModel(modelInput)} title="Apply model">✓</button>
          )}
        </div>

        <div className="ai-top-right">
          {isSpeaking && <span className="ai-speaking-badge">🔊 speaking…</span>}
          {messages.length > 0 && (
            <button className="ai-clear-btn" onClick={clearConversation}>Clear</button>
          )}
          <button
            className={`ai-settings-btn${showSettings ? " active" : ""}`}
            onClick={() => setShowSettings((p) => !p)}
          >
            ⚙ Settings
          </button>
        </div>
      </div>

      {/* ── health panel ─────────────────────────────────────────────────── */}
      {showHealthPanel && (
        <div className="ai-health-panel">
          <div className="ai-health-panel-header">
            <span>Server life signals</span>
            <button className="ai-health-ai-btn" onClick={pingAiHealth} disabled={aiHealthLoading}>
              {aiHealthLoading ? "Pinging AI…" : "🤖 Ping AI key"}
            </button>
          </div>

          {aiHealthResult && (
            <div className={`ai-health-ai-result ${aiHealthResult.ok ? "ok" : "fail"}`}>
              {aiHealthResult.ok
                ? `✔ API key works — reply in ${aiHealthResult.elapsed}ms`
                : `✘ API key failed — ${aiHealthResult.error}`}
            </div>
          )}

          <div className="ai-health-signals">
            {healthSignals.length === 0 && (
              <span className="ai-health-empty">No signals yet…</span>
            )}
            {healthSignals.map((s, i) => (
              <div key={i} className={`ai-health-signal ${s.ok ? "ok" : "fail"}`}>
                <span className="ai-health-signal-dot">{s.ok ? "●" : "○"}</span>
                <span className="ai-health-signal-time">
                  {new Date(s.timestamp).toLocaleTimeString()}
                </span>
                {s.age && (
                  <span className="ai-health-signal-age">up {s.age}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── settings panel ──────────────────────────────────────────────── */}
      {showSettings && (
        <div className="ai-settings-panel">

          <div className="ai-settings-section">
            <label className="ai-settings-label">API Key</label>
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
                placeholder={serverHasKey ? "Server key active — paste to override" : "sk-or-…"}
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
            <span className="ai-key-hint">
              {keyStatus === "checking" && <span style={{ color: "#888" }}>Checking server…</span>}
              {keyStatus === "ui"       && <span style={{ color: "#4caf50" }}>✔ Using your key</span>}
              {keyStatus === "server"   && <span style={{ color: "#4caf50" }}>✔ Server key active</span>}
              {keyStatus === "none"     && <span style={{ color: "#e94560" }}>⚠ No key — enter one above or set OPENROUTER_API_KEY on the server</span>}
            </span>
          </div>

          <div className="ai-settings-section">
            <label className="ai-settings-label">System prompt</label>
            <textarea
              className="ai-settings-textarea"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g. You are a helpful assistant."
            />
          </div>

          <div className="ai-settings-section">
            <label className="ai-settings-label">
              Reply length — <span className="ai-words-value">{maxWords} words</span>
            </label>
            <div className="ai-words-row">
              <span className="ai-words-edge">5</span>
              <input
                type="range"
                className="ai-words-range"
                min={5} max={20} step={1}
                value={maxWords}
                onChange={(e) => handleMaxWordsChange(Number(e.target.value))}
              />
              <span className="ai-words-edge">20</span>
              <input
                type="number"
                className="ai-words-number"
                min={5} max={20}
                value={maxWords}
                onChange={(e) => {
                  const v = Math.min(20, Math.max(5, Number(e.target.value)));
                  handleMaxWordsChange(v);
                }}
              />
            </div>
          </div>

          <div className="ai-settings-row">
            <label className="ai-settings-check">
              <input type="checkbox" checked={ttsEnabled} onChange={(e) => setTtsEnabled(e.target.checked)} />
              Read replies aloud
            </label>
            <label className="ai-settings-check">
              Voice:
              <select className="ai-lang-select" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)}>
                {VOICE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
          </div>

        </div>
      )}

      {/* ── mode bar ────────────────────────────────────────────────────── */}
      <div className="ai-mode-bar">
        <button
          className={`ai-mode-btn${voiceMode === "manual" ? " active" : ""}`}
          onClick={() => handleVoiceModeChange("manual")}
        >
          ✋ Manual
        </button>
        <button
          className={`ai-mode-btn${voiceMode === "auto" ? " active" : ""}`}
          onClick={() => handleVoiceModeChange("auto")}
        >
          🔄 Auto
        </button>
        {voiceMode === "auto" && (
          <span className="ai-mode-hint">
            {isSpeaking ? "AI speaking…" :
             isLoading  ? "Thinking…"   :
             listening  ? "Listening…"  :
                          "Starting…"}
          </span>
        )}
      </div>

      {/* ── messages ────────────────────────────────────────────────────── */}
      <div className="ai-messages">
        {messages.length === 0 && !isLoading && (
          <div className="ai-empty">
            <p>Start a conversation.</p>
            {voiceMode === "manual"
              ? <p>Type a message or press 🎤 to speak.<br />
                  <span style={{ fontSize: "0.8rem" }}>Shift+Enter for a new line · Enter to send</span>
                </p>
              : <p>Auto mode is on — just speak and the AI will reply automatically.</p>
            }
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
          className={`ai-mic-btn${
            listening
              ? " listening"
              : voiceMode === "auto" && !isLoading && !isSpeaking
              ? " auto-ready"
              : ""
          }`}
          onClick={toggleListening}
          title={listening ? "Stop recording" : "Start recording"}
        >🎤</button>
        <textarea
          ref={textareaRef}
          className={isInterim ? "interim" : ""}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            listening ? "Listening…" :
            voiceMode === "auto" && !isLoading && !isSpeaking
              ? "Auto mode — starting mic…"
              : "Type a message or press 🎤 to speak…"
          }
          rows={1}
        />
        <button
          className="ai-send-btn"
          onClick={sendMessage}
          disabled={!inputText.trim() || isLoading}
          title="Send"
        >➤</button>
      </div>

    </div>
  );
};

export default React.memo(AiConversation);
