import React, { useState } from 'react';
import { Mic, Send, Settings, Terminal, Wifi, AlertTriangle, Square, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AffordanceFirst() {
  const [isRecording, setIsRecording] = useState(false);
  const [micMode, setMicMode] = useState<'manual' | 'auto'>('manual');
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="w-full h-[1080px] bg-[#111827] text-slate-100 flex flex-col overflow-hidden font-sans selection:bg-[#e94560] selection:text-white">
      {/* Top Navigation Bar */}
      <header className="flex-none h-20 border-b border-slate-800 bg-[#1f2937] px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Voice Assistant</h1>
          
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20">
            <Wifi className="w-5 h-5" />
            <span className="font-semibold text-sm uppercase tracking-wider">Server Connected</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            className="h-12 px-6 gap-3 border-slate-600 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 transition-colors"
          >
            <Terminal className="w-5 h-5 text-[#3b82f6]" />
            <span className="font-medium text-base">Debug Log</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-12 px-6 gap-3 border-slate-600 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-200 transition-colors"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="font-medium text-base">Settings</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Chat Thread */}
        <div className="flex-1 flex flex-col bg-[#111827] relative">
          
          {/* API Warning (mocked) */}
          <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 m-8 mb-0 rounded-r-md flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-amber-500 font-bold text-lg">API Key Recommended</h3>
              <p className="text-amber-200/80 mt-1">Add your OpenAI API key in settings to remove usage limits.</p>
            </div>
          </div>

          <ScrollArea className="flex-1 p-8">
            <div className="max-w-4xl mx-auto space-y-8 pb-32">
              
              {/* AI Message */}
              <div className="flex flex-col items-start gap-2">
                <div className="flex items-center gap-2 ml-2">
                  <div className="w-8 h-8 rounded-full bg-[#3b82f6] flex items-center justify-center shadow-lg">
                    <span className="font-bold text-white text-sm">AI</span>
                  </div>
                  <span className="text-slate-400 font-medium">Assistant</span>
                </div>
                <div className="bg-slate-800 border border-slate-700 text-slate-100 p-6 rounded-2xl rounded-tl-none max-w-[85%] shadow-md text-lg leading-relaxed">
                  Hello! I'm ready to help. You can type a message below, or click the large microphone button to speak to me.
                </div>
              </div>

              {/* User Message */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-slate-400 font-medium">You</span>
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center shadow-lg">
                    <span className="font-bold text-white text-sm">U</span>
                  </div>
                </div>
                <div className="bg-[#3b82f6] text-white p-6 rounded-2xl rounded-tr-none max-w-[85%] shadow-md text-lg leading-relaxed border border-blue-400">
                  That sounds great. I'll test the microphone now.
                </div>
              </div>

            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#111827] via-[#111827] to-transparent pt-32 pointer-events-none">
            <div className="max-w-5xl mx-auto bg-slate-800 rounded-3xl p-6 border-2 border-slate-700 shadow-2xl flex flex-col gap-6 pointer-events-auto">
              
              {/* Controls row */}
              <div className="flex items-center justify-between px-2">
                {/* Mode Toggle */}
                <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-2xl border border-slate-700">
                  <span className="text-slate-400 font-semibold px-4">Mic Mode:</span>
                  <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                    <button 
                      onClick={() => setMicMode('manual')}
                      className={`px-6 py-3 rounded-lg font-bold text-base transition-all ${
                        micMode === 'manual' 
                          ? 'bg-[#3b82f6] text-white shadow-md' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      MANUAL
                    </button>
                    <button 
                      onClick={() => setMicMode('auto')}
                      className={`px-6 py-3 rounded-lg font-bold text-base transition-all ${
                        micMode === 'auto' 
                          ? 'bg-[#3b82f6] text-white shadow-md' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      AUTO
                    </button>
                  </div>
                </div>

                {/* Status text */}
                <div className="text-slate-400 font-medium text-lg">
                  {isRecording ? (
                    <span className="text-[#e94560] animate-pulse flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#e94560]"></span>
                      Recording...
                    </span>
                  ) : (
                    "Ready"
                  )}
                </div>
              </div>

              {/* Input row */}
              <div className="flex items-center gap-4">
                <Input 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type or press mic to speak…" 
                  className="flex-1 h-20 text-xl px-8 bg-slate-900 border-2 border-slate-700 rounded-2xl text-white placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:border-[#3b82f6]"
                />
                
                <Button 
                  size="lg"
                  className="h-20 px-10 rounded-2xl bg-[#3b82f6] hover:bg-blue-500 text-white font-bold text-xl flex items-center gap-3 shadow-lg border-2 border-blue-400 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Send className="w-6 h-6" />
                  <span>SEND</span>
                </Button>
              </div>

              {/* HUGE Mic Button */}
              <div className="absolute left-1/2 -top-16 -translate-x-1/2">
                <button
                  onClick={() => setIsRecording(!isRecording)}
                  className={`
                    flex flex-col items-center justify-center gap-2 rounded-full w-32 h-32 border-4 shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95
                    ${isRecording 
                      ? 'bg-[#e94560] border-red-400 text-white animate-pulse shadow-[0_0_40px_rgba(233,69,96,0.6)]' 
                      : 'bg-slate-700 border-slate-500 text-slate-200 hover:bg-slate-600 hover:border-slate-400'
                    }
                  `}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-12 h-12 fill-current" />
                      <span className="font-bold tracking-widest text-sm uppercase">Stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-12 h-12" />
                      <span className="font-bold tracking-widest text-sm uppercase">Speak</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Settings Sidebar (Toggled) */}
        {showSettings && (
          <div className="w-[480px] bg-[#1f2937] border-l border-slate-800 flex flex-col shadow-2xl z-10">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Settings className="w-6 h-6 text-[#3b82f6]" />
                Configuration
              </h2>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white"
              >
                <ChevronDown className="w-6 h-6 rotate-90" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-8">
                
                {/* Settings Block */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider block">AI Model</label>
                  <select className="w-full h-14 bg-slate-800 border-2 border-slate-700 rounded-xl px-4 text-white text-lg font-medium focus:ring-2 focus:ring-[#3b82f6] outline-none">
                    <option>GPT-4o</option>
                    <option>Claude 3.5 Sonnet</option>
                    <option>Llama 3</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider block">Voice (TTS)</label>
                  <select className="w-full h-14 bg-slate-800 border-2 border-slate-700 rounded-xl px-4 text-white text-lg font-medium focus:ring-2 focus:ring-[#3b82f6] outline-none">
                    <option>Nova (Female)</option>
                    <option>Echo (Male)</option>
                    <option>Alloy (Neutral)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider block">System Prompt</label>
                  <textarea 
                    className="w-full h-32 bg-slate-800 border-2 border-slate-700 rounded-xl p-4 text-slate-200 text-base focus:ring-2 focus:ring-[#3b82f6] outline-none resize-none"
                    placeholder="Enter instructions for the AI..."
                    defaultValue="You are a helpful voice assistant. Keep answers concise."
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-400 uppercase tracking-wider block">Spoken Language</label>
                  <select className="w-full h-14 bg-slate-800 border-2 border-slate-700 rounded-xl px-4 text-white text-lg font-medium focus:ring-2 focus:ring-[#3b82f6] outline-none">
                    <option>English (US)</option>
                    <option>Spanish (ES)</option>
                    <option>French (FR)</option>
                  </select>
                </div>

                <Button className="w-full h-14 bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg rounded-xl border-2 border-slate-500 mt-4">
                  Save Settings
                </Button>

              </div>
            </ScrollArea>
          </div>
        )}

      </div>
    </div>
  );
}
