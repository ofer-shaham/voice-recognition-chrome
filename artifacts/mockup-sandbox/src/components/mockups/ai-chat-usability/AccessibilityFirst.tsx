import React, { useState } from 'react';
import { Mic, Send, Settings, Activity, TriangleAlert, Bug, Square } from 'lucide-react';

export function AccessibilityFirst() {
  const [isRecording, setIsRecording] = useState(false);
  const [micMode, setMicMode] = useState<'Manual mode' | 'Auto mode'>('Manual mode');
  const [message, setMessage] = useState('');

  const messages = [
    { role: 'You', content: 'What are the main principles of web accessibility?' },
    { role: 'AI', content: 'The main principles of web accessibility are often summarized by the acronym POUR: Perceivable, Operable, Understandable, and Robust.\n\n1. Perceivable: Information and user interface components must be presentable to users in ways they can perceive.\n2. Operable: User interface components and navigation must be operable.\n3. Understandable: Information and the operation of user interface must be understandable.\n4. Robust: Content must be robust enough that it can be interpreted by a wide variety of user agents, including assistive technologies.' },
    { role: 'You', content: 'Can you give an example of Perceivable?' },
    { role: 'AI', content: 'Certainly! A common example of making content Perceivable is providing text alternatives (alt text) for non-text content like images. This allows users who are blind or have low vision to use screen readers to hear a description of the image, ensuring they can perceive the information the image conveys.' }
  ];

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-[#f0f0f0] font-sans selection:bg-amber-400 selection:text-black">
      {/* Sidebar */}
      <div className="w-[400px] border-r border-[#333] flex flex-col justify-between p-8 bg-[#111]">
        <div>
          <h1 className="text-3xl font-bold mb-10 tracking-tight text-white">AI Voice Assistant</h1>
          
          <div className="space-y-8">
            <div className="bg-amber-400 text-black p-5 rounded-lg flex items-start gap-4 border-[3px] border-amber-600 shadow-sm" role="alert">
              <TriangleAlert className="w-8 h-8 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <strong className="block text-[18px] font-extrabold mb-1">API Key Required</strong>
                <p className="text-[16px] leading-[1.6] font-medium">Please enter your OpenAI API key in settings to enable voice chat functionality.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-[16px] font-bold uppercase tracking-widest text-[#d0d0d0] border-b border-[#333] pb-2">Status</h2>
              <div className="flex items-center gap-4 text-[18px] font-medium">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center border-2 border-green-700" aria-hidden="true">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-100"></div>
                </div>
                <span>Server Health: Excellent</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-8">
              <h2 className="text-[16px] font-bold uppercase tracking-widest text-[#d0d0d0] border-b border-[#333] pb-2">Controls</h2>
              
              <button 
                className="w-full flex items-center gap-4 px-5 py-4 rounded-md border-2 border-[#555] bg-[#1a1a1a] hover:bg-[#2a2a2a] hover:border-white focus:outline-none focus:ring-[4px] focus:ring-white focus:ring-offset-4 focus:ring-offset-[#111] transition-all"
                aria-label="Open Settings and Preferences"
              >
                <Settings className="w-6 h-6 text-white" aria-hidden="true" />
                <span className="text-[18px] font-bold text-white">Settings & Preferences</span>
              </button>

              <button 
                className="w-full flex items-center gap-4 px-5 py-4 rounded-md border-2 border-[#555] bg-[#1a1a1a] hover:bg-[#2a2a2a] hover:border-white focus:outline-none focus:ring-[4px] focus:ring-white focus:ring-offset-4 focus:ring-offset-[#111] transition-all"
                aria-label="Open Debug Log"
              >
                <Bug className="w-6 h-6 text-white" aria-hidden="true" />
                <span className="text-[18px] font-bold text-white">STT / TTS Debug Log</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[#333] pt-6">
           <p className="text-[16px] font-medium text-[#a0a0a0]">Version 3.0.1 (High Contrast Mode)</p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#0a0a0a]">
        {/* Chat Thread */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-4xl mx-auto space-y-12">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'You' ? 'items-end' : 'items-start'}`}>
                <span className="text-[16px] font-extrabold text-[#d0d0d0] mb-2 uppercase tracking-widest bg-[#222] px-3 py-1 rounded-sm border border-[#444]">
                  {msg.role}
                </span>
                <div 
                  className={`max-w-[65ch] p-6 rounded-xl border-2 ${
                    msg.role === 'You' 
                      ? 'bg-[#1a1a2e] border-[#4a4a7a] text-[#ffffff]' 
                      : 'bg-[#1a1a1a] border-[#555555] text-[#ffffff]'
                  }`}
                >
                  <p className="text-[18px] leading-[1.75] font-medium whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-8 lg:p-12 border-t-[3px] border-[#333] bg-[#0a0a0a]">
          <div className="max-w-4xl mx-auto flex flex-col gap-8">
            
            {/* Mode Toggle */}
            <fieldset className="flex items-center gap-8 bg-[#111] p-4 rounded-lg border-2 border-[#333] w-max">
              <legend className="sr-only">Microphone Mode</legend>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="radio" 
                    name="micMode" 
                    value="Manual mode"
                    checked={micMode === 'Manual mode'}
                    onChange={() => setMicMode('Manual mode')}
                    className="peer w-6 h-6 appearance-none border-2 border-[#888] rounded-full checked:border-white focus:outline-none focus:ring-[4px] focus:ring-white focus:ring-offset-4 focus:ring-offset-[#111]"
                  />
                  <div className="absolute w-3 h-3 bg-white rounded-full hidden peer-checked:block pointer-events-none"></div>
                </div>
                <span className="text-[18px] font-bold text-[#e0e0e0] group-hover:text-white transition-colors">Manual mode</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="radio" 
                    name="micMode" 
                    value="Auto mode"
                    checked={micMode === 'Auto mode'}
                    onChange={() => setMicMode('Auto mode')}
                    className="peer w-6 h-6 appearance-none border-2 border-[#888] rounded-full checked:border-white focus:outline-none focus:ring-[4px] focus:ring-white focus:ring-offset-4 focus:ring-offset-[#111]"
                  />
                  <div className="absolute w-3 h-3 bg-white rounded-full hidden peer-checked:block pointer-events-none"></div>
                </div>
                <span className="text-[18px] font-bold text-[#e0e0e0] group-hover:text-white transition-colors">Auto mode</span>
              </label>
            </fieldset>

            {/* Input Bar */}
            <div className="flex gap-6">
              <div className="relative flex-1">
                <label htmlFor="message-input" className="sr-only">Type your message</label>
                <input 
                  id="message-input"
                  type="text" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full h-[64px] pl-6 pr-20 rounded-lg bg-[#111] border-[3px] border-[#555] text-[#ffffff] text-[20px] font-medium placeholder:text-[#a0a0a0] placeholder:opacity-100 placeholder:font-medium focus:outline-none focus:border-white focus:ring-[4px] focus:ring-white focus:ring-offset-4 focus:ring-offset-[#0a0a0a] transition-all"
                />
                <button 
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-white text-black rounded-md hover:bg-[#e0e0e0] focus:outline-none focus:ring-[4px] focus:ring-white focus:ring-offset-4 focus:ring-offset-[#111] transition-all border-2 border-transparent focus:border-black"
                  aria-label="Send message"
                >
                  <Send className="w-7 h-7" aria-hidden="true" />
                </button>
              </div>

              <button 
                onClick={() => setIsRecording(!isRecording)}
                className={`flex items-center gap-4 min-w-[200px] justify-center px-8 h-[64px] rounded-lg border-[3px] font-extrabold text-[20px] transition-all focus:outline-none focus:ring-[4px] focus:ring-white focus:ring-offset-4 focus:ring-offset-[#0a0a0a] ${
                  isRecording 
                    ? 'bg-[#d93025] border-[#ff8a80] text-white hover:bg-[#b3140b]' 
                    : 'bg-[#111] border-[#777] text-white hover:bg-[#2a2a2a] hover:border-white'
                }`}
                aria-pressed={isRecording}
                aria-label={isRecording ? "Stop recording voice" : "Start recording voice"}
              >
                {isRecording ? (
                  <>
                    <Square className="w-7 h-7 fill-current" aria-hidden="true" />
                    <span>STOP</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-7 h-7" aria-hidden="true" />
                    <span>RECORD</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
