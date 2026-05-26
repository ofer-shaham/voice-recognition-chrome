import React, { useState } from "react";
import { 
  Settings, 
  Terminal, 
  Mic, 
  Send, 
  User, 
  Bot, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  isLatest?: boolean;
}

const mockMessages: Message[] = [
  {
    id: "1",
    role: "user",
    content: "Hi, I'd like to practice my Spanish conversation. Can we talk about travel?",
  },
  {
    id: "2",
    role: "ai",
    content: "¡Hola! That sounds great. Traveling is a wonderful topic. Do you have a specific destination in mind, or should we talk about general travel experiences?",
  },
  {
    id: "3",
    role: "user",
    content: "I'm thinking about visiting Madrid next year.",
  },
  {
    id: "4",
    role: "ai",
    content: "¡Qué emocionante! Madrid is a beautiful city with so much history and culture. What are you most looking forward to seeing or doing there? The art museums like El Prado, the food, or maybe just walking around the Retiro Park?",
    isLatest: true,
  }
];

export function HierarchyFirst() {
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<"Manual" | "Auto">("Auto");

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-screen w-full bg-[#0d1117] text-slate-300 font-sans overflow-hidden">
        
        {/* NARROW SIDEBAR */}
        <div className="w-[64px] flex flex-col items-center py-6 border-r border-slate-800/60 bg-[#090b0f] shrink-0 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-800/50 cursor-pointer transition-colors mb-auto">
                <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-slate-800 text-slate-200 border-slate-700">
              <p>System Health: Optimal</p>
              <p className="text-xs text-slate-400">Latency: 42ms</p>
            </TooltipContent>
          </Tooltip>

          <div className="flex flex-col gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-800/50 text-slate-500 hover:text-slate-300">
                  <Terminal className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-slate-800 text-slate-200 border-slate-700">
                <p>Debug Logs</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-800/50 text-slate-500 hover:text-slate-300">
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-slate-800 text-slate-200 border-slate-700">
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div className="flex flex-col flex-1 relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/20 via-[#0d1117] to-[#0d1117]">
          
          {/* OPTIONAL API BANNER (Hidden by default unless error) */}
          {/* <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-amber-500/90 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            <span>OpenAI API Key missing or invalid. Please update in settings.</span>
          </div> */}

          <ScrollArea className="flex-1 w-full relative">
            <div className="max-w-4xl mx-auto w-full px-8 py-12 flex flex-col gap-10">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-6 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <Avatar className={`h-10 w-10 shrink-0 border border-slate-800 ${msg.role === "ai" ? "bg-[#e94560]/10 border-[#e94560]/30" : "bg-slate-800"}`}>
                    <AvatarFallback className="bg-transparent">
                      {msg.role === "ai" ? <Bot className={`h-5 w-5 ${msg.isLatest ? "text-[#e94560]" : "text-slate-400"}`} /> : <User className="h-5 w-5 text-slate-400" />}
                    </AvatarFallback>
                  </Avatar>

                  <div 
                    className={`
                      relative group max-w-[85%]
                      ${msg.role === "user" ? "bg-slate-800/50 rounded-2xl rounded-tr-sm px-6 py-4" : ""}
                      ${msg.role === "ai" && !msg.isLatest ? "pt-2 text-slate-300 text-lg leading-relaxed" : ""}
                      ${msg.role === "ai" && msg.isLatest ? "pt-1 text-slate-100 text-2xl leading-relaxed font-light tracking-wide drop-shadow-sm" : ""}
                    `}
                  >
                    {msg.role === "ai" && msg.isLatest && (
                      <div className="absolute -inset-4 bg-[#e94560]/5 blur-2xl rounded-[3rem] -z-10 opacity-70 pointer-events-none"></div>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              <div className="h-16" /> {/* Bottom spacer */}
            </div>
          </ScrollArea>

          {/* INPUT BAR */}
          <div className="p-6 pb-8 bg-gradient-to-t from-[#090b0f] via-[#090b0f] to-transparent shrink-0">
            <div className="max-w-4xl mx-auto relative flex flex-col gap-3">
              
              <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-full p-2 pl-4 pr-2 shadow-xl shadow-black/20 focus-within:border-[#e94560]/50 focus-within:ring-1 focus-within:ring-[#e94560]/20 transition-all">
                
                {/* MODE TOGGLE PILL */}
                <button 
                  onClick={() => setMode(mode === "Auto" ? "Manual" : "Auto")}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors focus:outline-none shrink-0"
                >
                  <div className={`h-1.5 w-1.5 rounded-full ${mode === "Auto" ? "bg-[#e94560]" : "bg-slate-500"}`} />
                  {mode}
                </button>

                <div className="w-px h-6 bg-slate-700 mx-1 shrink-0" />

                <input
                  type="text"
                  placeholder="Type a message or press mic to speak..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 bg-transparent border-none text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-0 text-base h-10 px-2"
                />

                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={`h-10 w-10 rounded-full shrink-0 transition-colors ${mode === "Auto" ? "text-[#e94560] hover:text-[#e94560] hover:bg-[#e94560]/10" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"}`}
                >
                  <Mic className="h-5 w-5" />
                </Button>

                <Button 
                  size="icon" 
                  className={`h-10 w-10 rounded-full shrink-0 transition-all ${inputValue.trim().length > 0 ? "bg-[#e94560] hover:bg-[#e94560]/90 text-white shadow-md shadow-[#e94560]/20" : "bg-slate-800 text-slate-500 hover:bg-slate-700"}`}
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </Button>

              </div>
              
              <div className="text-center text-xs text-slate-600 font-medium tracking-wide">
                Press Enter to send, or switch to Auto mode for continuous voice
              </div>
            </div>
          </div>

        </div>
      </div>
    </TooltipProvider>
  );
}
