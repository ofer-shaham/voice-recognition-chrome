import React, { useState, useEffect, useRef } from "react";
import { Mic, Send, MoreHorizontal, Activity, Settings2, FileText, Globe, Volume2, Maximize2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    text: "Can you explain the concept of wabi-sabi?",
  },
  {
    id: "2",
    role: "ai",
    text: "Wabi-sabi is a Japanese aesthetic and philosophical concept that finds beauty in imperfection, impermanence, and incompleteness. It is rooted in Zen Buddhism and stands in stark contrast to the Western ideal of flawless, enduring perfection.\n\nThere are three core realities to wabi-sabi: nothing lasts, nothing is finished, and nothing is perfect. It appreciates the cracks in a ceramic bowl, the asymmetrical growth of a tree, or the fading colors of autumn leaves. Rather than trying to preserve something in a pristine state, wabi-sabi embraces the natural cycle of growth, decay, and death.",
  },
  {
    id: "3",
    role: "user",
    text: "How does it apply to modern design?",
  },
  {
    id: "4",
    role: "ai",
    text: "In modern design, wabi-sabi manifests as a rejection of sterile, mass-produced uniformity in favor of warmth, texture, and authenticity.\n\nDesigners might use natural materials that age gracefully over time—like unlacquered brass that tarnishes, raw wood that shows its grain, or linen that wrinkles. It's about creating spaces and objects that feel lived-in and honest, allowing the passage of time to enhance rather than degrade their value.",
  }
];

export function ZeroChrome() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    setMessages(prev => [
      ...prev, 
      { id: Date.now().toString(), role: "user", text: input.trim() }
    ]);
    setInput("");
    
    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { 
          id: (Date.now() + 1).toString(), 
          role: "ai", 
          text: "I am contemplating your words. In this quiet space, meaning forms not through noise, but through the spaces between thoughts." 
        }
      ]);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className={`zerochrome-container flex flex-col h-screen w-full relative overflow-hidden ${isRecording ? 'zerochrome-recording' : ''}`}>
      
      {/* Hidden Secondary Controls */}
      <div className="absolute top-8 right-12 z-50">
        <Dialog>
          <DialogTrigger asChild>
            <button className="zerochrome-controls-trigger p-4 text-[#e8e6f0] hover:text-white focus:outline-none rounded-full flex items-center justify-center">
              <MoreHorizontal className="w-6 h-6" strokeWidth={1.5} />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-[#1a1625] text-[#e8e6f0] border-[#2a2538] max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-light tracking-wide text-[#e8e6f0]">Settings & Environment</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="settings" className="mt-4">
              <TabsList className="bg-[#121016] border border-[#2a2538]">
                <TabsTrigger value="settings" className="data-[state=active]:bg-[#2a2538] data-[state=active]:text-white"><Settings2 className="w-4 h-4 mr-2"/> General</TabsTrigger>
                <TabsTrigger value="model" className="data-[state=active]:bg-[#2a2538] data-[state=active]:text-white"><Globe className="w-4 h-4 mr-2"/> Model</TabsTrigger>
                <TabsTrigger value="logs" className="data-[state=active]:bg-[#2a2538] data-[state=active]:text-white"><Activity className="w-4 h-4 mr-2"/> Health & Logs</TabsTrigger>
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
                    <Label className="text-base text-[#e8e6f0]">Response Length Limit</Label>
                    <span className="text-sm text-[#a39ea8]">150 words</span>
                  </div>
                  <Slider defaultValue={[150]} max={500} step={10} className="[&_[role=slider]]:bg-white [&_.bg-primary]:bg-[#a39ea8] bg-[#2a2538]" />
                </div>
              </TabsContent>

              <TabsContent value="model" className="space-y-6 pt-4">
                <div className="space-y-3">
                  <Label className="text-[#a39ea8]">Language Model</Label>
                  <Select defaultValue="claude-3-opus">
                    <SelectTrigger className="bg-[#121016] border-[#2a2538] text-[#e8e6f0]">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1625] border-[#2a2538] text-[#e8e6f0]">
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="llama-3">Llama 3 70B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label className="text-[#a39ea8]">System Prompt Context</Label>
                  <textarea 
                    className="w-full h-32 bg-[#121016] border border-[#2a2538] rounded-md p-3 text-[#e8e6f0] focus:outline-none focus:border-[#4a4060] resize-none"
                    defaultValue="You are a poetic, philosophical conversationalist. Favor depth over breadth. Speak simply but thoughtfully."
                  />
                </div>
              </TabsContent>

              <TabsContent value="logs" className="space-y-4 pt-4">
                <div className="flex items-center space-x-2 text-emerald-400 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-medium">Server Status: Optimal</span>
                </div>
                <div className="bg-[#121016] border border-[#2a2538] rounded-md p-4 h-48 overflow-y-auto font-mono text-xs text-[#a39ea8] space-y-2">
                  <p>[10:42:01] INFO: WebSocket connection established.</p>
                  <p>[10:42:05] STT: Audio stream started (sample_rate=16000).</p>
                  <p>[10:42:15] STT: Partial transcript: "Can you explain..."</p>
                  <p>[10:42:18] STT: Final transcript: "Can you explain the concept of wabi-sabi?"</p>
                  <p>[10:42:18] LLM: Prompt dispatched to claude-3-opus.</p>
                  <p>[10:42:19] LLM: TTFT 850ms. Streaming response...</p>
                  <p>[10:42:24] LLM: Stream complete (tokens: 142).</p>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Conversation Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto zerochrome-scrollbar pb-32 pt-24 px-8 md:px-24 lg:px-64 xl:px-80"
      >
        <div className="max-w-4xl mx-auto flex flex-col justify-end min-h-full space-y-12">
          {messages.map((msg) => (
            <div key={msg.id} className="flex flex-col">
              {msg.role === "user" ? (
                <div className="text-[#a39ea8] italic text-lg mb-2 opacity-80 pl-4 md:pl-0">
                  You: {msg.text}
                </div>
              ) : (
                <div className="text-[#e8e6f0] text-xl md:text-2xl leading-relaxed font-light tracking-wide whitespace-pre-wrap">
                  {msg.text}
                </div>
              )}
            </div>
          ))}
          {/* Invisible anchor for scrolling */}
          <div className="h-4" />
        </div>
      </div>

      {/* Minimal Floating Input */}
      <div className="absolute bottom-12 left-0 right-0 px-8 md:px-24 lg:px-64 xl:px-80 flex justify-center pointer-events-none">
        <div className="w-full max-w-4xl pointer-events-auto">
          <div className="zerochrome-input rounded-2xl flex items-end p-2 px-4 backdrop-blur-sm bg-[#16141a]/60">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write or speak..."
              className="flex-1 bg-transparent border-none text-[#e8e6f0] text-lg focus:outline-none resize-none py-3 min-h-[52px] max-h-48"
              rows={1}
              style={{
                height: "auto",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 192)}px`;
              }}
            />
            <div className="flex items-center space-x-2 pb-2 pl-2">
              <button 
                onClick={toggleRecording}
                className={`p-2 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isRecording 
                    ? "text-[#e8e6f0]" 
                    : "text-[#a39ea8] hover:text-[#e8e6f0]"
                }`}
              >
                <Mic className="w-5 h-5" strokeWidth={isRecording ? 2.5 : 1.5} />
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
