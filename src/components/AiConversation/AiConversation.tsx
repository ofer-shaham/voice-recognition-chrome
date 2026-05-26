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
import { OPENROUTER_MODELS as MODEL_LIST } from "../../services/openRouterService";
import { freeSpeak, findVoice } from "../../utils/freeSpeak";
import { translate } from "../../utils/translate";
import { isMobile } from "../../services/isMobile";
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

const PRESET_PROMPTS = [
  "You are a language conversation partner using the comprehensible input method. Use only vocabulary the learner already knows. Recycle words and sentence structures repeatedly. If you must introduce a new word, use it several times and make its meaning clear from context. Never use rare, advanced, or idiomatic expressions unless the learner introduces them first.",
  "You are a playful storytelling companion for a child. Build a fun, imaginative story one sentence at a time, using simple words and a warm, encouraging tone.",
  "You are a helpful, concise assistant who helps creating a story line by line",
  "You are a poet. Reply with a single verse each time.",
  "You are a witty comedian. Keep replies short and funny.",
  "You are a strict teacher. Correct the user's grammar and reply briefly.",
  "You are a philosopher. Answer every question with a deeper question.",
  "You are a pirate. Speak in pirate slang, arrr!",
];

const VOCAB_LEVELS = [
  {
    level: 1,
    label: "Controlled",
    hint: "Only familiar words — maximum repetition, zero new words",
    instruction:
      "VOCABULARY RULE: Use only the simplest, most common words. Repeat key words and phrases many times within your reply. Do NOT introduce any new vocabulary. If you need a concept that requires an unfamiliar word, describe it using only words already used in this conversation.",
  },
  {
    level: 2,
    label: "Beginner",
    hint: "High repetition — at most 1 new word, always explained",
    instruction:
      "VOCABULARY RULE: Use simple, familiar vocabulary with high repetition. You may introduce at most 1 new word per reply — use it at least twice and immediately explain it using simpler words the learner already knows.",
  },
  {
    level: 3,
    label: "Elementary",
    hint: "Some new words — explained through context",
    instruction:
      "VOCABULARY RULE: Use moderately simple vocabulary. Repeat important words often. You may introduce at most 2 new words per reply — each should appear multiple times and be clear from context.",
  },
  {
    level: 4,
    label: "Intermediate",
    hint: "Varied vocabulary, occasional repetition",
    instruction:
      "VOCABULARY RULE: Use varied but not advanced vocabulary. Repeat key terms when helpful. New words may appear naturally; avoid rare or idiomatic expressions.",
  },
  {
    level: 5,
    label: "Natural",
    hint: "No restrictions — native-speed conversation",
    instruction: "",
  },
];

const LS_KEY_API = "ai_conversation_api_key";
const LS_KEY_MODEL = "ai_conversation_model";
const LS_KEY_WORDS = "ai_max_words";
const LS_KEY_MODE = "ai_voice_mode";
const LS_KEY_PROMPTS = "ai_prompt_list";
const LS_KEY_AUTOREPLACE = "ai_autoreplace_sec";
const LS_KEY_VOCAB_LEVEL = "ai_vocab_level";
const LS_KEY_STT_LANG = "ai_stt_lang";
const LS_KEY_AI_LANG = "ai_ai_lang";
const LS_KEY_TTS_RATES = "ai_tts_rates";
const LS_KEY_TRANSLATE_TO = "ai_translate_to";
const LS_KEY_REPEAT_LINES = "ai_repeat_lines";
const LS_KEY_SELECTED_VOICES = "ai_selected_voices";

const lsGet = (key: string, fallback: string) =>
  localStorage.getItem(key) || fallback;
const lsSet = (key: string, value: string) => {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
};
const lsGetJSON = (key: string, fallback: string[]) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const lsSetJSON = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const API_BASE = process.env.REACT_APP_API_URL || "";

interface HealthSignal {
  timestamp: number;
  ok: boolean;
  age?: string;
  uptime?: number;
}

interface AiHealthEntry {
  ok: boolean;
  elapsed?: number;
  error?: string;
  timestamp?: number;
  keySuffix?: string;
}

interface FreeModel {
  id: string;
  label: string;
}

interface SttLogEntry {
  ts: number;
  source: "stt" | "tts" | "app";
  event: string;
  detail?: string;
}

const getModelLabel = (modelId: string): string => {
  const match = MODEL_LIST.find((m) => m.id === modelId);
  if (match) return match.label;
  const parts = modelId.split("/");
  const shortName = parts[parts.length - 1].replace(/:free$/, "");
  return shortName;
};

const AiConversation: React.FC = () => {
  // ── conversation ───────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ── model ──────────────────────────────────────────────────────────────────
  const [modelInput, setModelInput] = useState(() =>
    lsGet(LS_KEY_MODEL, DEFAULT_MODEL),
  );
  const [activeModel, setActiveModel] = useState(() =>
    lsGet(LS_KEY_MODEL, DEFAULT_MODEL),
  );
  const [freeModels, setFreeModels] = useState<FreeModel[]>([]);

  // ── api key ────────────────────────────────────────────────────────────────
  const [uiApiKey, setUiApiKey] = useState(() => lsGet(LS_KEY_API, ""));
  const [activeApiKey, setActiveApiKey] = useState(() => lsGet(LS_KEY_API, ""));
  const [showKey, setShowKey] = useState(false);
  const [serverHasKey, setServerHasKey] = useState<boolean | null>(null);

  // ── settings ───────────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [promptList, setPromptList] = useState<string[]>(() =>
    lsGetJSON(LS_KEY_PROMPTS, PRESET_PROMPTS),
  );
  const [systemPrompt, setSystemPrompt] = useState(() =>
    lsGetJSON(LS_KEY_PROMPTS, PRESET_PROMPTS)[0],
  );
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [sttLang, setSttLang] = useState(() => lsGet(LS_KEY_STT_LANG, "en-US"));
  const [aiLang, setAiLang] = useState(() => lsGet(LS_KEY_AI_LANG, "en-US"));
  const [ttsRates, setTtsRates] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_TTS_RATES) || "{}"); }
    catch { return {}; }
  });
  const [isPlayingStory, setIsPlayingStory] = useState(false);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [playingMsgIndex, setPlayingMsgIndex] = useState<number | null>(null);
  const [playingCharIndex, setPlayingCharIndex] = useState<number | null>(null);
  const [translateToLang, setTranslateToLang] = useState(() => lsGet(LS_KEY_TRANSLATE_TO, ""));
  const [repeatFromLines, setRepeatFromLines] = useState<number>(() =>
    parseInt(lsGet(LS_KEY_REPEAT_LINES, "0"), 10),
  );
  const [selectedVoiceNames, setSelectedVoiceNames] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_SELECTED_VOICES) || "{}"); }
    catch { return {}; }
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [maxWords, setMaxWords] = useState<number>(() =>
    parseInt(lsGet(LS_KEY_WORDS, "12"), 10),
  );
  const [voiceMode, setVoiceMode] = useState<"manual" | "auto">(
    () => lsGet(LS_KEY_MODE, "manual") as "manual" | "auto",
  );
  const [autoReplaceSec, setAutoReplaceSec] = useState<number>(() =>
    parseInt(lsGet(LS_KEY_AUTOREPLACE, "0"), 10),
  );
  const [vocabLevel, setVocabLevel] = useState<number>(() =>
    parseInt(lsGet(LS_KEY_VOCAB_LEVEL, "3"), 10),
  );
  const [showPromptAccordion, setShowPromptAccordion] = useState(false);

  // ── api key warning banner ─────────────────────────────────────────────────
  const [apiKeyWarning, setApiKeyWarning] = useState<string | null>(null);
  const [apiKeyWarningDismissed, setApiKeyWarningDismissed] = useState(false);

  // ── server health indicator ────────────────────────────────────────────────
  const [healthSignals, setHealthSignals] = useState<HealthSignal[]>([]);
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const [serverAlive, setServerAlive] = useState<boolean | null>(null);

  // ── ai health ─────────────────────────────────────────────────────────────
  const [aiHealthHistory, setAiHealthHistory] = useState<AiHealthEntry[]>([]);
  const [aiHealthLoading, setAiHealthLoading] = useState(false);

  // ── mic permission ────────────────────────────────────────────────────────
  const [micDenied, setMicDenied] = useState(false);
  const micDeniedRef = useRef(false);

  // ── stt debug log ─────────────────────────────────────────────────────────
  const [sttLogs, setSttLogs] = useState<SttLogEntry[]>([]);
  const [showSttDebug, setShowSttDebug] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sttStatus, setSttStatus] = useState<"idle" | "listening" | "error">(
    "idle",
  );
  const sttDebugEndRef = useRef<HTMLDivElement>(null);

  // ── auto-replace timer ─────────────────────────────────────────────────────
  const autoReplaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractedRef = useRef(false);
  const regenerateFromIndexRef = useRef<(index: number) => void>(() => {});

  // ── refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevListeningRef = useRef(false);
  const isLoadingRef = useRef(isLoading);
  const isSpeakingRef = useRef(isSpeaking);
  const voiceModeRef = useRef(voiceMode);
  const sttLangRef = useRef(sttLang);
  const aiLangRef = useRef(aiLang);
  const ttsRatesRef = useRef(ttsRates);
  const playbackCancelRef = useRef(false);
  const autoReplaceSecRef = useRef(autoReplaceSec);
  const selectedVoiceNamesRef = useRef(selectedVoiceNames);
  const translateToLangRef = useRef(translateToLang);
  const repeatFromLinesRef = useRef(repeatFromLines);
  const translationCacheRef = useRef<Map<string, string>>(new Map());
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);
  useEffect(() => { sttLangRef.current = sttLang; }, [sttLang]);
  useEffect(() => { aiLangRef.current = aiLang; }, [aiLang]);
  useEffect(() => { ttsRatesRef.current = ttsRates; }, [ttsRates]);
  useEffect(() => { autoReplaceSecRef.current = autoReplaceSec; }, [autoReplaceSec]);
  useEffect(() => { selectedVoiceNamesRef.current = selectedVoiceNames; }, [selectedVoiceNames]);
  useEffect(() => { translateToLangRef.current = translateToLang; }, [translateToLang]);
  useEffect(() => { repeatFromLinesRef.current = repeatFromLines; }, [repeatFromLines]);

  // Load available browser voices
  useEffect(() => {
    const load = () => setAvailableVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Scroll to playing message
  useEffect(() => {
    if (playingMsgIndex !== null) {
      const el = document.querySelectorAll(".ai-message")[playingMsgIndex];
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [playingMsgIndex]);

  // ── speech recognition ────────────────────────────────────────────────────
  const {
    transcript,
    interimTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  // ── effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (transcript) setInputText(transcript);
  }, [transcript]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
  useEffect(() => {
    checkServerKey().then(setServerHasKey);
  }, []);

  // ── auto-check AI key on load ──────────────────────────────────────────────
  useEffect(() => {
    const savedKey = lsGet(LS_KEY_API, "");
    const body: Record<string, string> = {};
    if (savedKey) body.apiKey = savedKey;
    fetch(`${API_BASE}/api/health_ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setApiKeyWarning(
            data.error?.slice(0, 120) || "AI service unavailable",
          );
        }
      })
      .catch(() => {
        setApiKeyWarning("Could not reach the AI service — check your connection.");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── server health polling ─────────────────────────────────────────────────
  const pingHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const signal: HealthSignal = {
          timestamp: data.timestamp ?? Date.now(),
          ok: true,
          age: data.age,
          uptime: data.uptime,
        };
        setHealthSignals((prev) => [signal, ...prev].slice(0, 20));
        setServerAlive(true);
      } else {
        setHealthSignals((prev) =>
          [{ timestamp: Date.now(), ok: false }, ...prev].slice(0, 20),
        );
        setServerAlive(false);
      }
    } catch {
      setHealthSignals((prev) =>
        [{ timestamp: Date.now(), ok: false }, ...prev].slice(0, 20),
      );
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
    fetch(`${API_BASE}/api/free-models`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.models?.length) setFreeModels(data.models);
      })
      .catch(() => {});
  }, []);

  // ── ai health ping ────────────────────────────────────────────────────────
  const pingAiHealth = useCallback(async () => {
    setAiHealthLoading(true);
    try {
      const body: Record<string, string> = {};
      if (activeApiKey) body.apiKey = activeApiKey;
      const res = await fetch(`${API_BASE}/api/health_ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const data = await res.json();
      const keyUsed = activeApiKey || (serverHasKey ? "server" : "");
      const keySuffix = keyUsed.length > 4
        ? `...${keyUsed.slice(-4)}`
        : keyUsed
          ? keyUsed
          : "none";
      const entry: AiHealthEntry = {
        ok: data.ok,
        elapsed: data.elapsed,
        error: data.error,
        timestamp: Date.now(),
        keySuffix,
      };
      setAiHealthHistory((prev) => [entry, ...prev].slice(0, 10));
    } catch (e: any) {
      const entry: AiHealthEntry = {
        ok: false,
        error: e.message,
        timestamp: Date.now(),
        keySuffix: "err",
      };
      setAiHealthHistory((prev) => [entry, ...prev].slice(0, 10));
    } finally {
      setAiHealthLoading(false);
    }
  }, [activeApiKey, serverHasKey]);

  // ── stt debug helpers ─────────────────────────────────────────────────────
  const addSttLog = useCallback(
    (source: "stt" | "tts" | "app", event: string, detail?: string) => {
      setSttLogs((prev) =>
        [...prev, { ts: Date.now(), source, event, detail }].slice(-300),
      );
    },
    [],
  );

  const copyLogsToClipboard = useCallback(() => {
    const text = sttLogs
      .map((e) => {
        const d = new Date(e.ts);
        const ts = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
        return `[${ts}] [${e.source.toUpperCase()}] ${e.event}${e.detail ? ` — ${e.detail}` : ""}`;
      })
      .join("\n");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(console.error);
  }, [sttLogs]);

  // Attach raw SpeechRecognition events for debug logging
  useEffect(() => {
    const recognition = SpeechRecognition.getRecognition() as any;
    if (!recognition) return;

    const RAW_EVENTS = [
      "start",
      "end",
      "error",
      "audiostart",
      "audioend",
      "speechstart",
      "speechend",
      "nomatch",
      "result",
    ];
    const handlers: Record<string, EventListener> = {};

    RAW_EVENTS.forEach((evt) => {
      handlers[evt] = (e: Event) => {
        let detail: string | undefined;
        if (evt === "error") detail = (e as any).error ?? "unknown";
        if (evt === "result") {
          const results = (e as any).results as SpeechRecognitionResultList;
          detail = Array.from(results)
            .map((r: SpeechRecognitionResult) => r[0].transcript)
            .join(" ")
            .slice(0, 80);
        }
        addSttLog("stt", evt, detail);

        if (evt === "start") setSttStatus("listening");
        if (evt === "error") {
          setSttStatus("error");
          // Stop all restart loops when the user denies microphone access
          const errCode = (e as any).error ?? "";
          if (errCode === "not-allowed" || errCode === "service-not-allowed") {
            micDeniedRef.current = true;
            setMicDenied(true);
            SpeechRecognition.stopListening();
          }
        }
        if (evt === "end")
          setSttStatus((prev) => (prev === "listening" ? "idle" : prev));
      };
      recognition.addEventListener(evt, handlers[evt]);
    });

    return () => {
      RAW_EVENTS.forEach((evt) =>
        recognition.removeEventListener(evt, handlers[evt]),
      );
    };
  }, [addSttLog]);

  useEffect(() => {
    if (showSttDebug)
      sttDebugEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sttLogs, showSttDebug]);

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

  const handleAutoReplaceChange = (val: number) => {
    setAutoReplaceSec(val);
    lsSet(LS_KEY_AUTOREPLACE, String(val));
  };

  const handleVocabLevelChange = (val: number) => {
    setVocabLevel(val);
    lsSet(LS_KEY_VOCAB_LEVEL, String(val));
  };

  const handleVoiceNameChange = useCallback((langCode: string, voiceName: string) => {
    setSelectedVoiceNames((prev) => {
      const next = { ...prev, [langCode]: voiceName };
      localStorage.setItem(LS_KEY_SELECTED_VOICES, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleTranslateToChange = (lang: string) => {
    setTranslateToLang(lang);
    lsSet(LS_KEY_TRANSLATE_TO, lang);
  };

  const handleRepeatFromLinesChange = (val: number) => {
    setRepeatFromLines(val);
    lsSet(LS_KEY_REPEAT_LINES, String(val));
  };

  const translateResponse = useCallback(
    async (content: string, fromLang: string, toLang: string): Promise<string> => {
      if (!toLang) return "";
      const fromBase = fromLang.split("-")[0].toLowerCase();
      const toBase = toLang.split("-")[0].toLowerCase();
      if (fromBase === toBase) return "";
      const cacheKey = `${content}||${fromBase}||${toBase}`;
      const cached = translationCacheRef.current.get(cacheKey);
      if (cached !== undefined) return cached;
      try {
        const result = await translate({ finalTranscriptProxy: content, fromLang: fromBase, toLang: toBase });
        translationCacheRef.current.set(cacheKey, result);
        return result;
      } catch {
        return "";
      }
    },
    [],
  );

  // ── prompt list management ─────────────────────────────────────────────────
  const addPrompt = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setPromptList((prev) => {
      const next = [...prev, trimmed];
      lsSetJSON(LS_KEY_PROMPTS, next);
      return next;
    });
  }, []);

  const removePrompt = useCallback((index: number) => {
    setPromptList((prev) => {
      const next = prev.filter((_, i) => i !== index);
      lsSetJSON(LS_KEY_PROMPTS, next);
      // If the removed prompt was the active one, switch to first
      if (prev[index] === systemPromptRef.current && next.length > 0) {
        setSystemPrompt(next[0]);
      }
      return next;
    });
  }, []);

  const selectPrompt = useCallback((prompt: string) => {
    setSystemPrompt(prompt);
  }, []);

  // ── start listening helper ─────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // Never re-prompt if the user already denied microphone access
    if (micDeniedRef.current) return;
    resetTranscript();
    setInputText("");
    addSttLog("app", "startListening", `lang=${sttLangRef.current}`);
    SpeechRecognition.startListening({
      language: sttLangRef.current,
      interimResults: true,
      continuous: false,
    });
  }, [resetTranscript, addSttLog]);

  // ── mic toggle ────────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening]);

  // ── ensure STT is stopped ─────────────────────────────────────────────────
  const ensureSttStopped = useCallback(() => {
    if (listening) {
      addSttLog("app", "stopListening", "ensuring STT off before TTS");
      SpeechRecognition.stopListening();
    }
  }, [listening, addSttLog]);

  // ── core send ─────────────────────────────────────────────────────────────
  const sendWithText = useCallback(
    async (
      text: string,
      currentMessages: ChatMessage[],
      model: string,
      apiKey: string,
      prompt: string,
      tts: boolean,
      words: number,
    ) => {
      if (!text || isLoadingRef.current) return;

      // Ensure STT is stopped before we proceed
      ensureSttStopped();
      resetTranscript();
      setInputText("");
      setError("");
      userInteractedRef.current = false;

      const userMsg: ChatMessage = { role: "user", content: text, lang_code: sttLangRef.current };
      const history: ChatMessage[] = [...currentMessages, userMsg];
      setMessages(history);
      setIsLoading(true);

      try {
        const wordInstruction = `Reply in ${words} words or fewer.`;
        const vocabInstruction =
          VOCAB_LEVELS.find((v) => v.level === vocabLevelRef.current)?.instruction ?? "";
        const aiLangLabel = VOICE_LANGS.find((l) => l.code === aiLangRef.current)?.label ?? "English";
        const langInstruction = `Always write your reply in ${aiLangLabel}. Do not use any other language.`;
        const repeatInstruction = repeatFromLinesRef.current > 0
          ? `REPETITION RULE: Only reuse vocabulary from the last ${repeatFromLinesRef.current} message exchange${repeatFromLinesRef.current === 1 ? "" : "s"}. Ignore vocabulary from earlier exchanges.`
          : "";
        const fullPrompt = [prompt, wordInstruction, vocabInstruction, langInstruction, repeatInstruction]
          .filter(Boolean)
          .join("\n");

        const context: ChatMessage[] = [
          { role: "system", content: fullPrompt },
          ...history,
        ];

        const maxTokens = Math.ceil(words * 2);
        const response = await chatWithAI(
          context,
          model,
          apiKey || undefined,
          maxTokens,
        );
        const assistantMsg: ChatMessage = { role: "assistant", content: response.content, model: response.model, lang_code: aiLangRef.current };
        setMessages((prev) => [...prev, assistantMsg]);

        // Translate if a target language is selected
        if (translateToLangRef.current && translateToLangRef.current !== aiLangRef.current) {
          translateResponse(response.content, aiLangRef.current, translateToLangRef.current)
            .then((translation) => {
              if (translation) {
                setMessages((prev) =>
                  prev.map((m, idx) => idx === prev.length - 1 ? { ...m, translation } : m),
                );
              }
            });
        }

        if (tts) {
          ensureSttStopped();
          setIsSpeaking(true);
          const spkLang = aiLangRef.current;
          const spkRate = ttsRatesRef.current[spkLang] ?? 1.0;
          const spkVoiceName = selectedVoiceNamesRef.current[spkLang];
          addSttLog("tts", "speak", `lang=${spkLang} rate=${spkRate} — ${response.content.slice(0, 50)}`);
          try {
            await freeSpeak(response.content, spkLang, spkRate, spkVoiceName);
            addSttLog("tts", "end", `lang=${spkLang}`);
          } catch (ttsErr: any) {
            addSttLog("tts", "error", ttsErr?.message ?? "unknown");
          }
          setIsSpeaking(false);
        }

        // Auto-replace: if user doesn't interact within X seconds, regenerate
        if (autoReplaceSecRef.current > 0) {
          const msgIndex = history.length; // index of the assistant message we just added
          autoReplaceTimerRef.current = setTimeout(() => {
            if (!userInteractedRef.current && !isLoadingRef.current) {
              addSttLog("app", "autoReplace", `${autoReplaceSecRef.current}s timeout`);
              regenerateFromIndexRef.current(msgIndex);
            }
          }, autoReplaceSecRef.current * 1000);
        }

        if (voiceModeRef.current === "auto") {
          setTimeout(() => startListening(), 300);
        }
      } catch (e: any) {
        setError(e.message || "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [resetTranscript, startListening, addSttLog, ensureSttStopped, translateResponse],
  );

  // ── ref copies to avoid stale closures ───────────────────────────────────
  const messagesRef = useRef(messages);
  const activeModelRef = useRef(activeModel);
  const activeApiKeyRef = useRef(activeApiKey);
  const systemPromptRef = useRef(systemPrompt);
  const ttsEnabledRef = useRef(ttsEnabled);
  const maxWordsRef = useRef(maxWords);
  const vocabLevelRef = useRef(vocabLevel);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { activeModelRef.current = activeModel; }, [activeModel]);
  useEffect(() => { activeApiKeyRef.current = activeApiKey; }, [activeApiKey]);
  useEffect(() => { systemPromptRef.current = systemPrompt; }, [systemPrompt]);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { maxWordsRef.current = maxWords; }, [maxWords]);
  useEffect(() => { vocabLevelRef.current = vocabLevel; }, [vocabLevel]);

  // ── magic keywords ────────────────────────────────────────────────────────
  const checkMagicKeywords = useCallback((text: string): boolean => {
    const normalized = text.trim().toLowerCase();
    if (normalized === "remove, remove, remove") {
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        const removeCount = last.role === "assistant" ? 2 : 1;
        setMessages((prev) => prev.slice(0, Math.max(0, prev.length - removeCount)));
      }
      return true;
    }
    if (normalized === "clear, clear, clear") {
      setMessages([]);
      setError("");
      setInputText("");
      resetTranscript();
      return true;
    }
    return false;
  }, [messages, resetTranscript]);

  // ── regenerate from index ─────────────────────────────────────────────────
  const regenerateFromIndex = useCallback(
    async (index: number) => {
      if (isLoadingRef.current) return;

      // Clear any pending auto-replace timer
      if (autoReplaceTimerRef.current) {
        clearTimeout(autoReplaceTimerRef.current);
        autoReplaceTimerRef.current = null;
      }

      // Find the user message that precedes this message
      let userMsgIndex = -1;
      if (messages[index]?.role === "assistant") {
        userMsgIndex = index - 1;
      } else if (messages[index]?.role === "user") {
        userMsgIndex = index;
      }
      if (userMsgIndex < 0 || messages[userMsgIndex]?.role !== "user") return;

      const truncatedMessages = messages.slice(0, userMsgIndex);
      const userMsg = messages[userMsgIndex];
      const history: ChatMessage[] = [...truncatedMessages, userMsg];
      setMessages(history);
      setIsLoading(true);
      setError("");
      userInteractedRef.current = false;

      // Ensure STT is stopped
      ensureSttStopped();

      try {
        const wordInstruction = `Reply in ${maxWordsRef.current} words or fewer.`;
        const regenLangLabel = VOICE_LANGS.find((l) => l.code === aiLangRef.current)?.label ?? "English";
        const regenLangInstruction = `Always write your reply in ${regenLangLabel}. Do not use any other language.`;
        const regenRepeatInstruction = repeatFromLinesRef.current > 0
          ? `REPETITION RULE: Only reuse vocabulary from the last ${repeatFromLinesRef.current} message exchange${repeatFromLinesRef.current === 1 ? "" : "s"}. Ignore vocabulary from earlier exchanges.`
          : "";
        const fullPrompt = [systemPromptRef.current, wordInstruction, regenLangInstruction, regenRepeatInstruction]
          .filter(Boolean)
          .join("\n");

        const context: ChatMessage[] = [
          { role: "system", content: fullPrompt },
          ...history,
        ];

        const maxTokens = Math.ceil(maxWordsRef.current * 2);
        const response = await chatWithAI(
          context,
          activeModelRef.current,
          activeApiKeyRef.current || undefined,
          maxTokens,
        );
        const assistantMsg: ChatMessage = { role: "assistant", content: response.content, model: response.model, lang_code: aiLangRef.current };
        setMessages((prev) => [...prev, assistantMsg]);

        if (translateToLangRef.current && translateToLangRef.current !== aiLangRef.current) {
          translateResponse(response.content, aiLangRef.current, translateToLangRef.current)
            .then((translation) => {
              if (translation) {
                setMessages((prev) =>
                  prev.map((m, idx) => idx === prev.length - 1 ? { ...m, translation } : m),
                );
              }
            });
        }

        if (ttsEnabledRef.current) {
          ensureSttStopped();
          setIsSpeaking(true);
          const spkLang2 = aiLangRef.current;
          const spkRate2 = ttsRatesRef.current[spkLang2] ?? 1.0;
          const spkVoiceName2 = selectedVoiceNamesRef.current[spkLang2];
          addSttLog("tts", "speak", `lang=${spkLang2} rate=${spkRate2} — ${response.content.slice(0, 50)}`);
          try {
            await freeSpeak(response.content, spkLang2, spkRate2, spkVoiceName2);
            addSttLog("tts", "end", `lang=${spkLang2}`);
          } catch (ttsErr: any) {
            addSttLog("tts", "error", ttsErr?.message ?? "unknown");
          }
          setIsSpeaking(false);
        }

        // Auto-replace timer for regenerated message
        if (autoReplaceSecRef.current > 0) {
          const msgIndex = history.length;
          autoReplaceTimerRef.current = setTimeout(() => {
            if (!userInteractedRef.current && !isLoadingRef.current) {
              addSttLog("app", "autoReplace", `${autoReplaceSecRef.current}s timeout`);
              regenerateFromIndexRef.current(msgIndex);
            }
          }, autoReplaceSecRef.current * 1000);
        }

        if (voiceModeRef.current === "auto") {
          setTimeout(() => startListening(), 300);
        }
      } catch (e: any) {
        setError(e.message || "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [messages, addSttLog, ensureSttStopped, startListening, translateResponse],
  );

  // Keep ref in sync so auto-replace timer can call it without circular deps
  useEffect(() => {
    regenerateFromIndexRef.current = regenerateFromIndex;
  }, [regenerateFromIndex]);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || isLoadingRef.current) return;

    // Mark user interaction to cancel auto-replace
    userInteractedRef.current = true;
    if (autoReplaceTimerRef.current) {
      clearTimeout(autoReplaceTimerRef.current);
      autoReplaceTimerRef.current = null;
    }

    if (listening) SpeechRecognition.stopListening();

    if (checkMagicKeywords(text)) {
      setInputText("");
      resetTranscript();
      return;
    }

    sendWithText(
      text,
      messagesRef.current,
      activeModelRef.current,
      activeApiKeyRef.current,
      systemPromptRef.current,
      ttsEnabledRef.current,
      maxWordsRef.current,
    );
  }, [inputText, listening, sendWithText, checkMagicKeywords, resetTranscript]);

  // ── auto mode: send when mic stops ───────────────────────────────────────
  useEffect(() => {
    const wasListening = prevListeningRef.current;
    prevListeningRef.current = listening;

    if (
      voiceModeRef.current === "auto" &&
      wasListening &&
      !listening &&
      !isLoadingRef.current &&
      !isSpeakingRef.current
    ) {
      const text = transcript.trim();
      if (text) {
        userInteractedRef.current = true;
        if (autoReplaceTimerRef.current) {
          clearTimeout(autoReplaceTimerRef.current);
          autoReplaceTimerRef.current = null;
        }
        setTimeout(() => {
          sendWithText(
            text,
            messagesRef.current,
            activeModelRef.current,
            activeApiKeyRef.current,
            systemPromptRef.current,
            ttsEnabledRef.current,
            maxWordsRef.current,
          );
        }, 150);
      }
    }
  }, [listening, transcript, sendWithText]);

  // Auto mode: restart mic whenever it goes off and we're not busy.
  // Skip on mobile — mobile browsers fire `end` immediately when no speech
  // is detected, which causes an infinite start→end→start loop. On mobile,
  // the mic is restarted explicitly after the AI finishes speaking.
  // Also skip entirely if the user has denied microphone access.
  useEffect(() => {
    if (
      voiceMode === "auto" &&
      !listening &&
      !isLoading &&
      !isSpeaking &&
      !transcript.trim() &&
      !isMobile &&
      !micDenied
    ) {
      const id = setTimeout(() => startListening(), 400);
      return () => clearTimeout(id);
    }
  }, [voiceMode, listening, isLoading, isSpeaking, transcript, startListening, micDenied]);

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
    stopPlayback();
    if (autoReplaceTimerRef.current) {
      clearTimeout(autoReplaceTimerRef.current);
      autoReplaceTimerRef.current = null;
    }
  };

  const deleteFromLine = useCallback((fromIndex: number) => {
    if (autoReplaceTimerRef.current) {
      clearTimeout(autoReplaceTimerRef.current);
      autoReplaceTimerRef.current = null;
    }
    setMessages((prev) => prev.slice(0, fromIndex));
    setError("");
  }, []);

  const handleTtsRateChange = useCallback((langCode: string, rate: number) => {
    setTtsRates((prev) => {
      const next = { ...prev, [langCode]: rate };
      localStorage.setItem(LS_KEY_TTS_RATES, JSON.stringify(next));
      return next;
    });
  }, []);

  const stopPlayback = useCallback(() => {
    playbackCancelRef.current = true;
    speechSynthesis.cancel();
    setIsPlayingStory(false);
    setPlaybackPaused(false);
    setPlayingMsgIndex(null);
    setPlayingCharIndex(null);
  }, []);

  const playStory = useCallback(() => {
    const msgs = messagesRef.current;
    if (msgs.length === 0) return;

    SpeechRecognition.stopListening();
    speechSynthesis.cancel();
    playbackCancelRef.current = false;
    setIsPlayingStory(true);
    setPlaybackPaused(false);
    setPlayingMsgIndex(null);
    setPlayingCharIndex(null);

    const voices = speechSynthesis.getVoices();

    msgs.forEach((msg, idx) => {
      const langCode =
        msg.lang_code ||
        (msg.role === "user" ? sttLangRef.current : aiLangRef.current);
      const rate = ttsRatesRef.current[langCode] ?? 1.0;

      const utterance = new SpeechSynthesisUtterance(msg.content);
      utterance.lang = langCode;
      utterance.rate = Math.max(0.1, Math.min(10, rate));

      const savedVoiceName = selectedVoiceNamesRef.current[langCode];
      const voice = savedVoiceName
        ? (voices.find((v) => v.name === savedVoiceName) ?? findVoice(voices, langCode, isMobile))
        : findVoice(voices, langCode, isMobile);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = langCode;
      }

      utterance.onstart = () => {
        setPlayingMsgIndex(idx);
        setPlayingCharIndex(null);
      };
      utterance.onboundary = (event) => {
        if (event.name === "word") {
          setPlayingCharIndex(event.charIndex);
        }
      };

      const isLast = idx === msgs.length - 1;
      utterance.onend = () => {
        if (isLast) {
          setIsPlayingStory(false);
          setPlaybackPaused(false);
          setPlayingMsgIndex(null);
          setPlayingCharIndex(null);
        }
      };
      utterance.onerror = () => {
        if (isLast) {
          setIsPlayingStory(false);
          setPlaybackPaused(false);
          setPlayingMsgIndex(null);
          setPlayingCharIndex(null);
        }
      };

      speechSynthesis.speak(utterance);
    });
  }, []);

  const togglePlaybackPause = useCallback(() => {
    if (playbackPaused) {
      speechSynthesis.resume();
      setPlaybackPaused(false);
    } else {
      speechSynthesis.pause();
      setPlaybackPaused(true);
    }
  }, [playbackPaused]);

  // ── derived ────────────────────────────────────────────────────────────────
  const isInterim = listening && !!interimTranscript;
  const modelDirty = modelInput !== activeModel;
  const keyDirty = uiApiKey !== activeApiKey;

  const keyStatus: "ui" | "server" | "none" | "checking" = activeApiKey
    ? "ui"
    : serverHasKey === null
      ? "checking"
      : serverHasKey
        ? "server"
        : "none";

  const allModels: FreeModel[] = React.useMemo(() => {
    const base = freeModels.length ? freeModels : OPENROUTER_MODELS;
    const seen = new Set(base.map((m) => m.id));
    const extra = OPENROUTER_MODELS.filter((m) => !seen.has(m.id));
    return [...base, ...extra];
  }, [freeModels]);

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

  const healthDotClass =
    serverAlive === null
      ? "health-dot checking"
      : serverAlive
        ? "health-dot alive"
        : "health-dot dead";

  return (
    <div className="ai-conversation">
      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <div className="ai-top-bar">
        <h2>AI Conversation</h2>

        <button
          className="ai-health-btn"
          onClick={() => {
            setShowHealthPanel((p) => !p);
            pingHealth();
          }}
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
            onBlur={(e) => commitModel(e.target.value)}
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
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </datalist>
          {modelDirty && (
            <button
              className="ai-model-apply"
              onClick={() => commitModel(modelInput)}
              title="Apply model"
            >
              ✓
            </button>
          )}
        </div>

        <div className="ai-lang-bar">
          <span className="ai-lang-bar-label" title="Your speaking language">🎤</span>
          <select
            className="ai-lang-select-top"
            value={sttLang}
            title="Your speaking language (microphone)"
            onChange={(e) => { setSttLang(e.target.value); lsSet(LS_KEY_STT_LANG, e.target.value); }}
          >
            {VOICE_LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <span className="ai-lang-bar-arrow">→</span>
          <span className="ai-lang-bar-label" title="AI reply language">🔊</span>
          <select
            className="ai-lang-select-top"
            value={aiLang}
            title="AI reply language (TTS)"
            onChange={(e) => { setAiLang(e.target.value); lsSet(LS_KEY_AI_LANG, e.target.value); }}
          >
            {VOICE_LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <span className="ai-lang-bar-arrow">→</span>
          <span className="ai-lang-bar-label" title="Translate AI reply to">📝</span>
          <select
            className="ai-lang-select-top"
            value={translateToLang}
            title="Translate AI reply to this language (leave blank to disable)"
            onChange={(e) => handleTranslateToChange(e.target.value)}
          >
            <option value="">No translation</option>
            {VOICE_LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        <div className="ai-top-right">
          <label className="ai-tts-toggle-top" title="Read AI replies aloud">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
            />
            <span className="ai-tts-toggle-icon">🔊</span>
          </label>
          {isSpeaking && (
            <span className="ai-speaking-badge">speaking...</span>
          )}
          {messages.length > 0 && !isPlayingStory && (
            <button className="ai-play-btn" onClick={playStory} title="Play story">▶</button>
          )}
          {isPlayingStory && (
            <>
              <button
                className={`ai-play-btn${playbackPaused ? " paused" : ""}`}
                onClick={togglePlaybackPause}
                title={playbackPaused ? "Resume" : "Pause"}
              >
                {playbackPaused ? "▶" : "⏸"}
              </button>
              <button className="ai-play-btn stop" onClick={stopPlayback} title="Stop">■</button>
            </>
          )}
          {messages.length > 0 && (
            <button className="ai-clear-btn" onClick={clearConversation}>
              Clear
            </button>
          )}
          <button
            className={`ai-settings-btn${showSettings ? " active" : ""}`}
            onClick={() => setShowSettings((p) => !p)}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* ── api key warning banner ───────────────────────────────────────── */}
      {apiKeyWarning && !apiKeyWarningDismissed && (
        <div className="ai-key-warning">
          <span className="ai-key-warning-icon">⚠</span>
          <span className="ai-key-warning-text">
            No working API key — {apiKeyWarning}.{" "}
            <button
              className="ai-key-warning-action"
              onClick={() => setShowSettings(true)}
            >
              Enter key in Settings
            </button>
          </span>
          <button
            className="ai-key-warning-dismiss"
            onClick={() => setApiKeyWarningDismissed(true)}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── mic denied banner ───────────────────────────────────────────── */}
      {micDenied && (
        <div className="ai-mic-denied-banner">
          <span className="ai-mic-denied-icon">🎤</span>
          <span className="ai-mic-denied-text">
            Microphone access was denied. Enable it in your browser settings, then{" "}
            <button
              className="ai-mic-denied-retry"
              onClick={() => {
                micDeniedRef.current = false;
                setMicDenied(false);
              }}
            >
              try again
            </button>
            .
          </span>
        </div>
      )}

      {/* ── health panel ─────────────────────────────────────────────────── */}
      {showHealthPanel && (
        <div className="ai-health-panel">
          <div className="ai-health-panel-header">
            <span>Server life signals</span>
            <button
              className="ai-health-ai-btn"
              onClick={pingAiHealth}
              disabled={aiHealthLoading}
            >
              {aiHealthLoading ? "Pinging AI..." : "Ping AI key"}
            </button>
          </div>

          {aiHealthHistory.length > 0 && (
            <div className="ai-health-ai-history">
              {aiHealthHistory.map((entry, i) => (
                <div
                  key={i}
                  className={`ai-health-ai-result ${entry.ok ? "ok" : "fail"}`}
                >
                  {entry.ok
                    ? `Key ${entry.keySuffix} OK — ${entry.elapsed}ms`
                    : `Key ${entry.keySuffix} failed — ${entry.error}`}
                  <span className="ai-health-ai-time">
                    {entry.timestamp
                      ? new Date(entry.timestamp).toLocaleTimeString()
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="ai-health-signals">
            {healthSignals.length === 0 && (
              <span className="ai-health-empty">No signals yet...</span>
            )}
            {healthSignals.map((s, i) => (
              <div
                key={i}
                className={`ai-health-signal ${s.ok ? "ok" : "fail"}`}
              >
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
                onBlur={(e) => commitApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    commitApiKey((e.target as HTMLInputElement).value);
                }}
                placeholder={
                  serverHasKey
                    ? "Server key active — paste to override"
                    : "sk-or-..."
                }
                spellCheck={false}
                autoComplete="off"
              />
              <button
                className="ai-key-toggle"
                onClick={() => setShowKey((p) => !p)}
                title={showKey ? "Hide" : "Show"}
              >
                {showKey ? "Hide" : "Show"}
              </button>
              {keyDirty && (
                <button
                  className="ai-key-save"
                  onClick={() => commitApiKey(uiApiKey)}
                >
                  Save
                </button>
              )}
              {activeApiKey && (
                <button
                  className="ai-key-clear"
                  onClick={clearApiKey}
                  title="Remove override"
                >
                  X
                </button>
              )}
            </div>
            <span className="ai-key-hint">
              {keyStatus === "checking" && (
                <span style={{ color: "#888" }}>Checking server...</span>
              )}
              {keyStatus === "ui" && (
                <span style={{ color: "#4caf50" }}>Using your key ...{activeApiKey.slice(-4)}</span>
              )}
              {keyStatus === "server" && (
                <span style={{ color: "#4caf50" }}>Server key active</span>
              )}
              {keyStatus === "none" && (
                <span style={{ color: "#e94560" }}>
                  No key — enter one above or set OPENROUTER_API_KEY on the server
                </span>
              )}
            </span>
          </div>

          <div className="ai-settings-section">
            <button
              className="ai-prompt-accordion-btn"
              onClick={() => setShowPromptAccordion((p) => !p)}
            >
              <span className="ai-prompt-accordion-title">System prompt</span>
              <span className={`ai-prompt-accordion-toggle${showPromptAccordion ? " open" : ""}`}>
                ▼
              </span>
            </button>

            {showPromptAccordion && (
              <div className="ai-prompt-accordion-content">
                <div className="ai-prompt-list">
                  {promptList.map((p, i) => (
                    <div
                      key={i}
                      className={`ai-prompt-item${p === systemPrompt ? " active" : ""}`}
                      onClick={() => selectPrompt(p)}
                      title={p}
                    >
                      <span className="ai-prompt-text">{p}</span>
                      <button
                        className="ai-prompt-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePrompt(i);
                        }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="ai-prompt-add-row">
                  <input
                    className="ai-prompt-add-input"
                    placeholder="Add a new prompt..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value;
                        if (val.trim()) {
                          addPrompt(val.trim());
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <button
                    className="ai-prompt-add-btn"
                    onClick={() => {
                      const input = document.querySelector(".ai-prompt-add-input") as HTMLInputElement;
                      if (input?.value.trim()) {
                        addPrompt(input.value.trim());
                        input.value = "";
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                <textarea
                  className="ai-settings-textarea"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="e.g. You are a helpful assistant."
                />
              </div>
            )}
          </div>

          <div className="ai-settings-section">
            <label className="ai-settings-label">
              Reply length —{" "}
              <span className="ai-words-value">{maxWords} words</span>
            </label>
            <div className="ai-words-row">
              <span className="ai-words-edge">5</span>
              <input
                type="range"
                className="ai-words-range"
                min={5}
                max={50}
                step={1}
                value={maxWords}
                onChange={(e) => handleMaxWordsChange(Number(e.target.value))}
              />
              <span className="ai-words-edge">50</span>
              <input
                type="number"
                className="ai-words-number"
                min={5}
                max={50}
                value={maxWords}
                onChange={(e) => {
                  const v = Math.min(50, Math.max(5, Number(e.target.value)));
                  handleMaxWordsChange(v);
                }}
              />
            </div>
          </div>

          <div className="ai-settings-section">
            <label className="ai-settings-label">
              Vocabulary level —{" "}
              <span className="ai-words-value">
                {VOCAB_LEVELS.find((v) => v.level === vocabLevel)?.label}
              </span>
            </label>
            <div className="ai-words-row">
              <span className="ai-words-edge">1</span>
              <input
                type="range"
                className="ai-words-range ai-vocab-range"
                min={1}
                max={5}
                step={1}
                value={vocabLevel}
                onChange={(e) => handleVocabLevelChange(Number(e.target.value))}
              />
              <span className="ai-words-edge">5</span>
            </div>
            <p className="ai-vocab-hint">
              {VOCAB_LEVELS.find((v) => v.level === vocabLevel)?.hint}
            </p>
          </div>

          <div className="ai-settings-section">
            <label className="ai-settings-label">
              Auto-replace —{" "}
              <span className="ai-words-value">
                {autoReplaceSec === 0 ? "Off" : `${autoReplaceSec}s`}
              </span>
            </label>
            <div className="ai-words-row">
              <span className="ai-words-edge">0</span>
              <input
                type="range"
                className="ai-words-range"
                min={0}
                max={30}
                step={1}
                value={autoReplaceSec}
                onChange={(e) => handleAutoReplaceChange(Number(e.target.value))}
              />
              <span className="ai-words-edge">30</span>
              <input
                type="number"
                className="ai-words-number"
                min={0}
                max={60}
                value={autoReplaceSec}
                onChange={(e) => {
                  const v = Math.min(60, Math.max(0, Number(e.target.value)));
                  handleAutoReplaceChange(v);
                }}
              />
            </div>
          </div>

          <div className="ai-settings-row">
            <label className="ai-settings-check">
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
              />
              Read replies aloud
            </label>
          </div>

          <div className="ai-settings-section">
            <label className="ai-settings-label">Playback speed per language</label>
            {VOICE_LANGS.map((l) => (
              <div key={l.code} className="ai-tts-rate-row">
                <span className="ai-tts-rate-lang">{l.label}</span>
                <input
                  type="range"
                  className="ai-words-range"
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={ttsRates[l.code] ?? 1.0}
                  onChange={(e) => handleTtsRateChange(l.code, Number(e.target.value))}
                />
                <span className="ai-tts-rate-value">{(ttsRates[l.code] ?? 1.0).toFixed(2)}×</span>
              </div>
            ))}
          </div>

          <div className="ai-settings-section">
            <label className="ai-settings-label">Voice per language</label>
            {VOICE_LANGS.map((l) => {
              const langVoices = availableVoices.filter((v) =>
                v.lang === l.code ||
                v.lang.replace("_", "-") === l.code ||
                v.lang.split(/[-_]/)[0].toLowerCase() === l.code.split("-")[0].toLowerCase(),
              );
              return (
                <div key={l.code} className="ai-voice-row">
                  <span className="ai-tts-rate-lang">{l.label}</span>
                  <select
                    className="ai-voice-select"
                    value={selectedVoiceNames[l.code] ?? ""}
                    onChange={(e) => handleVoiceNameChange(l.code, e.target.value)}
                  >
                    <option value="">Auto</option>
                    {langVoices.map((v) => (
                      <option key={v.name} value={v.name}>{v.name}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="ai-settings-section">
            <label className="ai-settings-label">
              Vocabulary recycling —{" "}
              <span className="ai-words-value">
                {repeatFromLines === 0 ? "All lines" : `Last ${repeatFromLines} exchanges`}
              </span>
            </label>
            <div className="ai-words-row">
              <span className="ai-words-edge">All</span>
              <input
                type="range"
                className="ai-words-range"
                min={0}
                max={10}
                step={1}
                value={repeatFromLines}
                onChange={(e) => handleRepeatFromLinesChange(Number(e.target.value))}
              />
              <span className="ai-words-edge">10</span>
              <input
                type="number"
                className="ai-words-number"
                min={0}
                max={20}
                value={repeatFromLines}
                onChange={(e) =>
                  handleRepeatFromLinesChange(Math.max(0, Number(e.target.value)))
                }
              />
            </div>
            <p className="ai-vocab-hint">
              {repeatFromLines === 0
                ? "Reuse vocabulary from the entire conversation."
                : `Only reuse vocabulary from the last ${repeatFromLines} message exchange${repeatFromLines === 1 ? "" : "s"}.`}
            </p>
          </div>
        </div>
      )}

      {/* ── mode bar ────────────────────────────────────────────────────── */}
      <div className="ai-mode-bar">
        <button
          className={`ai-mode-toggle${voiceMode === "auto" ? " is-auto" : ""}`}
          onClick={() => handleVoiceModeChange(voiceMode === "manual" ? "auto" : "manual")}
          title={voiceMode === "manual" ? "Switch to Auto mode" : "Switch to Manual mode"}
        >
          <span className="ai-mode-toggle-knob" />
          <span className="ai-mode-toggle-label">
            {voiceMode === "manual" ? "Manual" : "Auto"}
          </span>
        </button>
        {voiceMode === "auto" && (
          <span className="ai-mode-hint">
            {isSpeaking
              ? "AI speaking..."
              : isLoading
                ? "Thinking..."
                : listening
                  ? "Listening..."
                  : "Starting..."}
          </span>
        )}
        <button
          className={`ai-logs-btn${showSttDebug ? " panel-open" : ""} stt-${sttStatus}`}
          onClick={() => setShowSttDebug((p) => !p)}
          title="Voice event log"
        >
          Logs {showSttDebug ? "▲" : "▼"}
          {sttLogs.length > 0 && (
            <span className="ai-logs-count">{sttLogs.length}</span>
          )}
        </button>
      </div>

      {/* ── stt debug panel ──────────────────────────────────────────────── */}
      {showSttDebug && (
        <div className="ai-stt-panel">
          <div className="ai-stt-panel-header">
            <span className="ai-stt-panel-title">
              Voice events{" "}
              <span className="ai-stt-count">{sttLogs.length}</span>
            </span>
            <div className="ai-stt-panel-actions">
              <button
                className="ai-stt-action-btn"
                onClick={copyLogsToClipboard}
                title="Copy all logs to clipboard"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                className="ai-stt-action-btn"
                onClick={() => setSttLogs([])}
                title="Clear logs"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="ai-stt-log-list">
            {sttLogs.length === 0 && (
              <span className="ai-stt-empty">
                No events yet — try pressing the mic button
              </span>
            )}
            {sttLogs.map((entry, i) => {
              const d = new Date(entry.ts);
              const ts = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
              const isError = entry.event === "error";
              const isResult = entry.event === "result";
              return (
                <div
                  key={i}
                  className={`ai-stt-entry src-${entry.source}${isError ? " err" : isResult ? " res" : ""}`}
                >
                  <span className="ai-stt-ts">{ts}</span>
                  <span className={`ai-stt-badge badge-${entry.source}`}>
                    {entry.source.toUpperCase()}
                  </span>
                  <span className="ai-stt-evt">{entry.event}</span>
                  {entry.detail && (
                    <span className="ai-stt-detail">{entry.detail}</span>
                  )}
                </div>
              );
            })}
            <div ref={sttDebugEndRef} />
          </div>
        </div>
      )}

      {/* ── messages ────────────────────────────────────────────────────── */}
      <div className="ai-messages">
        {messages.length === 0 && !isLoading && (
          <div className="ai-empty">
            <p>Start a conversation.</p>
            {voiceMode === "manual" ? (
              <p>
                Type a message or press the mic button to speak.
                <br />
                <span style={{ fontSize: "0.8rem" }}>
                  Shift+Enter for a new line · Enter to send
                  <br />
                  Click any message to remove everything after it · Magic: "remove, remove, remove" deletes last
                </span>
              </p>
            ) : (
              <p>
                Auto mode is on — just speak and the AI will reply
                automatically.
              </p>
            )}
          </div>
        )}
        {messages.map((msg, i) => {
          const isPlaying = playingMsgIndex === i;
          const isAi = msg.role === "assistant";
          return (
            <div key={i} className={`ai-message ${msg.role}${isPlaying ? " ai-msg-playing" : ""}`}>
              <span className="ai-message-role">
                {isAi ? "AI" : "You"}
                {isAi && msg.model && (
                  <span className="ai-model-sig">{getModelLabel(msg.model)}</span>
                )}
              </span>
              <div
                className="ai-message-bubble ai-clickable"
                onClick={() => isAi ? regenerateFromIndex(i) : deleteFromLine(i + 1)}
                title={isAi ? "Click to regenerate from here" : "Click to remove all lines after this"}
              >
                {isPlaying && playingCharIndex !== null
                  ? (() => {
                      let pos = 0;
                      return msg.content.split(/(\s+)/).map((token, ti) => {
                        const start = pos;
                        pos += token.length;
                        const hl = /\S/.test(token) && playingCharIndex >= start && playingCharIndex < pos;
                        return hl
                          ? <mark key={ti} className="ai-word-playing">{token}</mark>
                          : <span key={ti}>{token}</span>;
                      });
                    })()
                  : msg.content}
              </div>
              {msg.translation && (
                <div className="ai-translation">{msg.translation}</div>
              )}
            </div>
          );
        })}
        {isLoading && <div className="ai-thinking">Thinking...</div>}
        {error && <div className="ai-error">! {error}</div>}
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
        >
          Mic
        </button>
        <textarea
          ref={textareaRef}
          className={isInterim ? "interim" : ""}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            listening
              ? "Listening..."
              : voiceMode === "auto" && !isLoading && !isSpeaking
                ? "Auto mode — starting mic..."
                : "Type a message or press the mic button to speak..."
          }
          rows={1}
        />
        <button
          className="ai-send-btn"
          onClick={sendMessage}
          disabled={!inputText.trim() || isLoading}
          title="Send"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default React.memo(AiConversation);
