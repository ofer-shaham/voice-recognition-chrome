import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Send, MoreHorizontal, Settings2, Activity, Globe } from "lucide-react";
import "./_zerochrome.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../ui/dialog";
import { Switch } from "../../ui/switch";
import { Slider } from "../../ui/slider";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  sttLang?: string;
  ttsLang?: string;
}

const LANGUAGES = [
  { code: "en-US", label: "EN", full: "English" },
  { code: "he-IL", label: "HE", full: "Hebrew" },
  { code: "ar-SA", label: "AR", full: "Arabic" },
  { code: "ru-RU", label: "RU", full: "Russian" },
  { code: "es-ES", label: "ES", full: "Spanish" },
  { code: "fr-FR", label: "FR", full: "French" },
  { code: "de-DE", label: "DE", full: "German" },
  { code: "zh-CN", label: "ZH", full: "Chinese" },
];

const langLabel = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code.split("-")[0].toUpperCase();

const INITIAL_MESSAGES: Message[] = [
  { id: "1", role: "user", text: "Can you explain the concept of wabi-sabi?", sttLang: "en-US" },
  {
    id: "2",
    role: "ai",
    text: "Wabi-sabi is a Japanese aesthetic and philosophical concept that finds beauty in imperfection, impermanence, and incompleteness. It is rooted in Zen Buddhism and stands in stark contrast to the Western ideal of flawless, enduring perfection.\n\nThere are three core realities to wabi-sabi: nothing lasts, nothing is finished, and nothing is perfect. It appreciates the cracks in a ceramic bowl, the asymmetrical growth of a tree, or the fading colors of autumn leaves.",
    ttsLang: "en-US",
  },
  { id: "3", role: "user", text: "How does it apply to modern design?", sttLang: "en-US" },
  {
    id: "4",
    role: "ai",
    text: "In modern design, wabi-sabi manifests as a rejection of sterile, mass-produced uniformity in favor of warmth, texture, and authenticity.\n\nDesigners might use natural materials that age gracefully—unlacquered brass that tarnishes, raw wood that shows its grain, linen that wrinkles. Spaces feel lived-in and honest; the passage of time enhances rather than degrades their value.",
    ttsLang: "en-US",
  },
];

const HOLD_DURATION = 3000;

export function ZeroChrome() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [sttLang, setSttLang] = useState("en-US");
  const [ttsLang, setTtsLang] = useState("en-US");

  // hold-to-delete
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef = useRef<number>(0);
  const holdingIdRef = useRef<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    holdingIdRef.current = holdingId;
  }, [holdingId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: input.trim(),
      sttLang,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          text: "I am contemplating your words. In this quiet space, meaning forms not through noise, but through the spaces between thoughts.",
          ttsLang,
        },
      ]);
    }, 1400);
  }, [input, sttLang, ttsLang]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── hold-to-delete ────────────────────────────────────────────────────────
  const clearHold = useCallback(() => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    holdTimerRef.current = null;
    setHoldingId(null);
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(
    (id: string) => {
      clearHold();
      setHoldingId(id);
      setHoldProgress(0);
      holdStartRef.current = Date.now();

      holdTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - holdStartRef.current;
        const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
        setHoldProgress(progress);

        if (elapsed >= HOLD_DURATION) {
          clearInterval(holdTimerRef.current!);
          holdTimerRef.current = null;
          const targetId = holdingIdRef.current;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === targetId);
            return idx >= 0 ? prev.slice(0, idx) : prev;
          });
          setHoldingId(null);
          setHoldProgress(0);
        }
      }, 30);
    },
    [clearHold],
  );

  // clean up on unmount
  useEffect(() => () => { if (holdTimerRef.current) clearInterval(holdTimerRef.current); }, []);

  const holdingIndex = messages.findIndex((m) => m.id === holdingId);

  return (
    <div
      className={`zerochrome-container flex flex-col h-screen w-full relative overflow-hidden ${isRecording ? "zerochrome-recording" : ""}`}
    >
      {/* Fade-in settings trigger */}
      <div className="absolute top-8 right-12 z-50">
        <Dialog>
          <DialogTrigger asChild>
            <button className="zerochrome-controls-trigger p-4 text-[#e8e6f0] rounded-full flex items-center justify-center">
              <MoreHorizontal className="w-6 h-6" strokeWidth={1.5} />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1625] text-[#e8e6f0] border-[#2a2538] max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-light tracking-wide text-[#e8e6f0]">
                Settings
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="settings" className="mt-4">
              <TabsList className="bg-[#121016] border border-[#2a2538]">
                <TabsTrigger
                  value="settings"
                  className="data-[state=active]:bg-[#2a2538] data-[state=active]:text-white"
                >
                  <Settings2 className="w-4 h-4 mr-2" /> General
                </TabsTrigger>
                <TabsTrigger
                  value="language"
                  className="data-[state=active]:bg-[#2a2538] data-[state=active]:text-white"
                >
                  <Globe className="w-4 h-4 mr-2" /> Languages
                </TabsTrigger>
                <TabsTrigger
                  value="logs"
                  className="data-[state=active]:bg-[#2a2538] data-[state=active]:text-white"
                >
                  <Activity className="w-4 h-4 mr-2" /> Health & Logs
                </TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base text-[#e8e6f0]">Auto-read aloud (TTS)</Label>
                    <p className="text-sm text-[#a39ea8]">Voice synthesis for incoming messages</p>
                  </div>
                  <Switch />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base text-[#e8e6f0]">Response length limit</Label>
                    <span className="text-sm text-[#a39ea8]">150 words</span>
                  </div>
                  <Slider
                    defaultValue={[150]}
                    max={500}
                    step={10}
                    className="[&_[role=slider]]:bg-white [&_.bg-primary]:bg-[#a39ea8]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="language" className="space-y-6 pt-4">
                <p className="text-sm text-[#a39ea8] leading-relaxed">
                  The language you speak (STT) and the language the AI responds in (TTS) can be set
                  independently — useful for translation or cross-language practice.
                </p>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[#a39ea8] text-xs uppercase tracking-widest">
                      🎤 Voice input (STT)
                    </Label>
                    <select
                      value={sttLang}
                      onChange={(e) => setSttLang(e.target.value)}
                      className="w-full bg-[#121016] border border-[#2a2538] rounded-md px-3 py-2 text-[#e8e6f0] text-sm focus:outline-none focus:border-[#4a4060]"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.full}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#a39ea8] text-xs uppercase tracking-widest">
                      🔊 Voice output (TTS)
                    </Label>
                    <select
                      value={ttsLang}
                      onChange={(e) => setTtsLang(e.target.value)}
                      className="w-full bg-[#121016] border border-[#2a2538] rounded-md px-3 py-2 text-[#e8e6f0] text-sm focus:outline-none focus:border-[#4a4060]"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.full}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {sttLang !== ttsLang && (
                  <div className="text-xs text-[#a39ea8] bg-[#121016] border border-[#2a2538] rounded-md px-4 py-3">
                    You speak in <span className="text-[#e8e6f0] font-medium">{LANGUAGES.find(l => l.code === sttLang)?.full}</span>,
                    the AI responds in <span className="text-[#e8e6f0] font-medium">{LANGUAGES.find(l => l.code === ttsLang)?.full}</span>.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="logs" className="space-y-4 pt-4">
                <div className="flex items-center space-x-2 text-emerald-400 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-medium">Server status: optimal</span>
                </div>
                <div className="bg-[#121016] border border-[#2a2538] rounded-md p-4 h-48 overflow-y-auto font-mono text-xs text-[#a39ea8] space-y-2">
                  <p>[10:42:01] INFO: WebSocket connection established.</p>
                  <p>[10:42:05] STT: Audio stream started (lang={sttLang}).</p>
                  <p>[10:42:15] STT: Partial transcript: "Can you explain..."</p>
                  <p>[10:42:18] STT: Final transcript: "Can you explain the concept of wabi-sabi?"</p>
                  <p>[10:42:18] LLM: Prompt dispatched.</p>
                  <p>[10:42:19] LLM: TTFT 850ms. Streaming response...</p>
                  <p>[10:42:24] LLM: Stream complete (tokens: 142).</p>
                  <p>[10:42:24] TTS: Speaking in {ttsLang}...</p>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="zerochrome-scrollbar flex-1 overflow-y-auto pb-36 pt-20 px-8 md:px-24 lg:px-64 xl:px-80"
      >
        <div className="max-w-3xl mx-auto flex flex-col justify-end min-h-full space-y-10">
          {messages.map((msg, i) => {
            const isHolding = msg.id === holdingId;
            const isDownstream = holdingIndex >= 0 && i > holdingIndex;
            return (
              <div
                key={msg.id}
                className={`zc-msg-wrap ${isHolding ? "holding" : ""} ${isDownstream ? "zc-msg-downstream" : ""}`}
                onMouseDown={() => startHold(msg.id)}
                onMouseUp={clearHold}
                onMouseLeave={clearHold}
                onTouchStart={() => startHold(msg.id)}
                onTouchEnd={clearHold}
                title="Hold 3 s to delete from here"
              >
                {msg.role === "user" ? (
                  <div className="text-[#a39ea8] italic text-base leading-relaxed opacity-80 pl-1 flex items-baseline gap-2">
                    <span className="text-[#4a4060] text-[0.65rem] uppercase tracking-widest font-semibold not-italic shrink-0">
                      {langLabel(msg.sttLang ?? sttLang)}
                    </span>
                    <span>{msg.text}</span>
                  </div>
                ) : (
                  <div className="text-[#e8e6f0] text-xl md:text-2xl leading-relaxed font-light tracking-wide whitespace-pre-wrap flex gap-3 items-start">
                    <span className="text-[#4a4060] text-[0.65rem] uppercase tracking-widest font-semibold mt-[0.4em] shrink-0">
                      {langLabel(msg.ttsLang ?? ttsLang)}
                    </span>
                    <span>{msg.text}</span>
                  </div>
                )}

                {/* hold progress bar */}
                {isHolding && (
                  <div
                    className="zc-hold-bar"
                    style={{ width: `${holdProgress}%` }}
                  />
                )}
              </div>
            );
          })}
          <div className="h-2" />
        </div>
      </div>

      {/* Input bar */}
      <div className="absolute bottom-10 left-0 right-0 px-8 md:px-24 lg:px-64 xl:px-80 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto space-y-2">

          {/* Language strip — sits just above the input, fades unless focused */}
          <div className="zerochrome-lang-bar flex items-center gap-2 px-1 text-[0.7rem] text-[#a39ea8]">
            <span className="uppercase tracking-widest text-[0.6rem] text-[#4a4060] font-semibold">speak</span>
            <div className="relative">
              <select
                value={sttLang}
                onChange={(e) => setSttLang(e.target.value)}
                className="zc-lang-select"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.full}</option>
                ))}
              </select>
              <span className="text-[#4a4060] ml-0.5">▾</span>
            </div>

            {sttLang !== ttsLang ? (
              <span className="text-[#3a3048] mx-1">→</span>
            ) : (
              <span className="text-[#3a3048] mx-1">·</span>
            )}

            <span className="uppercase tracking-widest text-[0.6rem] text-[#4a4060] font-semibold">hear</span>
            <div className="relative">
              <select
                value={ttsLang}
                onChange={(e) => setTtsLang(e.target.value)}
                className="zc-lang-select"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.full}</option>
                ))}
              </select>
              <span className="text-[#4a4060] ml-0.5">▾</span>
            </div>

            {sttLang !== ttsLang && (
              <span className="text-[#4a4060] italic ml-1">
                {LANGUAGES.find(l => l.code === sttLang)?.full} → {LANGUAGES.find(l => l.code === ttsLang)?.full}
              </span>
            )}
          </div>

          {/* Text + mic/send */}
          <div className="zerochrome-input rounded-2xl flex items-end p-2 px-4 backdrop-blur-sm bg-[#16141a]/60">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Speak or write in ${LANGUAGES.find(l => l.code === sttLang)?.full ?? "your language"}…`}
              className="flex-1 bg-transparent border-none text-[#e8e6f0] text-lg focus:outline-none resize-none py-3 min-h-[52px] max-h-48"
              rows={1}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 192)}px`;
              }}
            />
            <div className="flex items-center space-x-1 pb-2 pl-2">
              <button
                onClick={() => setIsRecording((r) => !r)}
                className={`p-2 rounded-full transition-all duration-300 ${
                  isRecording ? "text-[#e94560]" : "text-[#a39ea8] hover:text-[#e8e6f0]"
                }`}
                title={isRecording ? "Stop recording" : `Record in ${LANGUAGES.find(l => l.code === sttLang)?.full}`}
              >
                {isRecording ? (
                  <MicOff className="w-5 h-5" strokeWidth={2} />
                ) : (
                  <Mic className="w-5 h-5" strokeWidth={1.5} />
                )}
              </button>
              {input.trim() && (
                <button
                  onClick={handleSend}
                  className="p-2 rounded-full text-[#e8e6f0] hover:text-white transition-colors"
                >
                  <Send className="w-5 h-5" strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
