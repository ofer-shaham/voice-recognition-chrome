import React, { useState, useRef, useEffect } from 'react';
import { 
  Mic, 
  Send, 
  MoreHorizontal, 
  Settings, 
  Volume2, 
  VolumeX, 
  MessageSquare,
  Activity,
  Globe,
  Type
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export function LightConsumer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [autoMode, setAutoMode] = useState(false);
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected'>('connected');
  
  // Settings state
  const [model, setModel] = useState('gpt-4');
  const [language, setLanguage] = useState('en');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      const newAiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I hear you. I'm processing your request now. How can I help further?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, newAiMsg]);
    }, 1000);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans text-slate-900 selection:bg-teal-100">
      {/* Header - Minimal */}
      <header className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${serverStatus === 'connected' ? 'bg-teal-500' : 'bg-red-500'} shadow-sm`} title={`Server: ${serverStatus}`} />
          <h1 className="text-xl font-medium tracking-tight text-slate-800">Assistant</h1>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-lg border-slate-100">
            <div className="px-2 py-3 flex items-center justify-between">
              <Label htmlFor="auto-mode" className="text-sm font-medium text-slate-700 cursor-pointer">Auto Mode</Label>
              <Switch 
                id="auto-mode" 
                checked={autoMode} 
                onCheckedChange={setAutoMode}
                className="data-[state=checked]:bg-teal-500"
              />
            </div>
            
            <div className="px-2 py-3 flex items-center justify-between">
              <Label htmlFor="tts-mode" className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-2">
                {ttsEnabled ? <Volume2 className="w-4 h-4 text-slate-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                Read aloud
              </Label>
              <Switch 
                id="tts-mode" 
                checked={ttsEnabled} 
                onCheckedChange={setTtsEnabled}
                className="data-[state=checked]:bg-teal-500"
              />
            </div>

            <DropdownMenuSeparator className="bg-slate-100 my-1" />
            
            <DropdownMenuLabel className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1.5">Settings</DropdownMenuLabel>
            
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="rounded-xl focus:bg-slate-50 py-2.5">
                <Activity className="w-4 h-4 mr-2 text-slate-400" />
                <span>Model</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="rounded-xl shadow-lg border-slate-100 p-1">
                <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
                  <DropdownMenuRadioItem value="gpt-4" className="rounded-lg py-2">GPT-4</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="gpt-3.5" className="rounded-lg py-2">GPT-3.5 Turbo</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="claude-3" className="rounded-lg py-2">Claude 3 Opus</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="rounded-xl focus:bg-slate-50 py-2.5">
                <Globe className="w-4 h-4 mr-2 text-slate-400" />
                <span>Language</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="rounded-xl shadow-lg border-slate-100 p-1">
                <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                  <DropdownMenuRadioItem value="en" className="rounded-lg py-2">English</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="es" className="rounded-lg py-2">Spanish</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="fr" className="rounded-lg py-2">French</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="de" className="rounded-lg py-2">German</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem className="rounded-xl focus:bg-slate-50 py-2.5 cursor-pointer">
              <Type className="w-4 h-4 mr-2 text-slate-400" />
              <span>Prompt instructions</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-slate-100 my-1" />
            
            <DropdownMenuItem className="rounded-xl focus:bg-slate-50 py-2.5 text-slate-500 cursor-pointer">
              <Settings className="w-4 h-4 mr-2 text-slate-400" />
              <span>Advanced debug logs</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-24 xl:px-48 py-8 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-0 animate-in fade-in duration-700 slide-in-from-bottom-4">
            <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-teal-100/50">
              <MessageSquare className="w-8 h-8 text-teal-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-medium text-slate-800 mb-3 tracking-tight">How can I help you today?</h2>
            <p className="text-lg text-slate-500 max-w-md font-light leading-relaxed">
              Speak or type to get started. I'm here to assist with whatever you need.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-32">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-in slide-in-from-bottom-2 fade-in duration-300 ease-out`}
              >
                {msg.role === 'assistant' && (
                  <Avatar className="w-8 h-8 mr-3 mt-auto mb-1 border border-slate-100 shadow-sm shrink-0">
                    <AvatarFallback className="bg-slate-50 text-slate-400 text-xs font-medium">AI</AvatarFallback>
                  </Avatar>
                )}
                
                <div 
                  className={`
                    relative px-6 py-4 rounded-3xl max-w-[75%] text-[17px] leading-relaxed shadow-sm
                    ${msg.role === 'user' 
                      ? 'bg-teal-600 text-white rounded-br-sm' 
                      : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-bl-sm'
                    }
                  `}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input Area */}
      <div className="px-4 md:px-8 lg:px-24 xl:px-48 pb-8 pt-4 bg-gradient-to-t from-white via-white to-white/0 fixed bottom-0 w-full left-0">
        <div className="max-w-4xl mx-auto relative flex items-center bg-white border border-slate-200 rounded-full p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus-within:shadow-[0_8px_30px_rgb(13,148,136,0.1)] focus-within:border-teal-300 transition-all duration-300">
          
          <Button 
            onClick={toggleRecording}
            variant="ghost" 
            size="icon" 
            className={`
              w-12 h-12 rounded-full shrink-0 transition-all duration-300 
              ${isRecording 
                ? 'bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700 shadow-inner' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }
            `}
          >
            <Mic className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`} />
          </Button>

          <Input 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={isRecording ? "Listening..." : "Message Assistant..."}
            className="flex-1 border-0 focus-visible:ring-0 shadow-none text-lg px-4 h-12 font-light placeholder:text-slate-300 bg-transparent"
          />

          <Button 
            onClick={handleSend}
            disabled={!inputValue.trim()}
            size="icon"
            className={`
              w-10 h-10 rounded-full shrink-0 ml-2 transition-all duration-300 shadow-sm
              ${inputValue.trim() 
                ? 'bg-teal-600 hover:bg-teal-700 text-white scale-100 opacity-100' 
                : 'bg-slate-100 text-slate-300 scale-95 opacity-50 cursor-not-allowed'
              }
            `}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </div>
        <div className="text-center mt-3 text-xs text-slate-400 font-medium tracking-wide">
          Assistant can make mistakes. Consider verifying important information.
        </div>
      </div>
    </div>
  );
}
