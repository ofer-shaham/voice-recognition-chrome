import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Settings, X, Volume2, VolumeX, Circle, AlertTriangle, Key } from "lucide-react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../../ui/sheet";
import { Switch } from "../../ui/switch";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Slider } from "../../ui/slider";

export function Redesign() {
  const [messages, setMessages] = useState([
    { id: 1, role: "assistant", content: "Hello. How can I assist you today?" },
    { id: 2, role: "user", content: "I'd like to practice my Spanish." },
    { id: 3, role: "assistant", content: "¡Claro que sí! Podemos empezar cuando quieras. ¿De qué te gustaría hablar?" },
  ]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [autoMic, setAutoMic] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [showApiKeyWarning, setShowApiKeyWarning] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    setMessages([...messages, { id: Date.now(), role: "user", content: inputText }]);
    setInputText("");
    
    // Mock response
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now(), role: "assistant", content: "Entendido. ¡Sigamos practicando!" }]);
    }, 1000);
  };

  return (
    <div className="flex justify-center bg-black min-h-screen text-slate-200 font-sans">
      {/* Mobile container constraint for mockup purposes */}
      <div className="w-full max-w-[390px] h-[100dvh] bg-[#0d1117] flex flex-col relative overflow-hidden shadow-2xl border-x border-[#1e2634]">
        
        {/* API Key Warning */}
        {showApiKeyWarning && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-start gap-3 relative z-20">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-amber-500 font-medium text-sm">Missing API Key</h4>
              <p className="text-amber-500/80 text-xs mt-0.5">Please configure your OpenRouter API key in settings to continue.</p>
            </div>
            <button onClick={() => setShowApiKeyWarning(false)} className="text-amber-500/50 hover:text-amber-500 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Bar */}
        <header className="px-4 h-14 flex items-center justify-between border-b border-[#1e2634] bg-[#0d1117]/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-white tracking-wide">VoiceAI</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
              <Circle className="w-2 h-2 fill-current" />
              <span>Ready</span>
            </div>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/5 h-8 w-8 rounded-full">
                  <Settings className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-[#151b23] border-[#30363d] text-slate-200 sm:max-w-md w-full p-6 flex flex-col gap-6" side="bottom">
                <SheetHeader>
                  <SheetTitle className="text-white text-left">Settings</SheetTitle>
                </SheetHeader>
                
                <div className="space-y-6 overflow-y-auto pb-6">
                  {/* API Key */}
                  <div className="space-y-3">
                    <Label className="text-slate-400 text-xs uppercase tracking-wider">Authentication</Label>
                    <div className="relative">
                      <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input 
                        type="password" 
                        placeholder="sk-or-v1-..." 
                        className="bg-[#0d1117] border-[#30363d] pl-9 text-sm focus-visible:ring-[#e94560]"
                      />
                    </div>
                  </div>

                  {/* Model & Language */}
                  <div className="space-y-3">
                    <Label className="text-slate-400 text-xs uppercase tracking-wider">Configuration</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Select defaultValue="gpt-4o-mini">
                        <SelectTrigger className="bg-[#0d1117] border-[#30363d]">
                          <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#151b23] border-[#30363d] text-slate-200">
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select defaultValue="en">
                        <SelectTrigger className="bg-[#0d1117] border-[#30363d]">
                          <SelectValue placeholder="Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#151b23] border-[#30363d] text-slate-200">
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Speech */}
                  <div className="space-y-4">
                    <Label className="text-slate-400 text-xs uppercase tracking-wider">Speech</Label>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Text-to-Speech</Label>
                        <p className="text-xs text-slate-500">Read responses aloud</p>
                      </div>
                      <Switch 
                        checked={ttsEnabled} 
                        onCheckedChange={setTtsEnabled} 
                        className="data-[state=checked]:bg-[#e94560]"
                      />
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Message Thread */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32 scroll-smooth"
        >
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm
                  ${msg.role === 'user' 
                    ? 'bg-[#1e2634] text-white rounded-br-sm border border-[#30363d]' 
                    : 'bg-[#151b23] text-slate-200 rounded-bl-sm border border-[#30363d]'
                  }
                `}
              >
                {msg.content}
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#30363d] text-slate-500">
                    <button className="hover:text-white transition-colors">
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] uppercase font-medium tracking-wider">AI Model</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 pt-8 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/95 to-transparent">
          
          {/* Mode Toggle Pill */}
          <div className="flex justify-center mb-4">
            <div className="bg-[#151b23] border border-[#30363d] rounded-full p-1 flex items-center shadow-lg">
              <button 
                onClick={() => setAutoMic(false)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${!autoMic ? 'bg-[#30363d] text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                Manual
              </button>
              <button 
                onClick={() => setAutoMic(true)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${autoMic ? 'bg-[#30363d] text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                Auto
              </button>
            </div>
          </div>

          {/* Input Bar */}
          <div className="flex items-end gap-2 bg-[#151b23] border border-[#30363d] rounded-2xl p-1 shadow-xl">
            <button 
              className={`p-3 rounded-xl transition-all shrink-0 ${isRecording ? 'bg-[#e94560]/20 text-[#e94560]' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              onClick={() => setIsRecording(!isRecording)}
            >
              {isRecording ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            
            <textarea 
              className="flex-1 bg-transparent border-0 text-white placeholder-slate-500 text-[15px] resize-none py-3 focus:ring-0 min-h-[44px] max-h-[120px]"
              placeholder={isRecording ? "Listening..." : "Type a message..."}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            
            <button 
              className={`p-3 rounded-xl transition-all shrink-0 ${inputText.trim() ? 'bg-[#e94560] text-white shadow-md' : 'text-slate-600 bg-[#1e2634]'}`}
              onClick={handleSend}
              disabled={!inputText.trim()}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
