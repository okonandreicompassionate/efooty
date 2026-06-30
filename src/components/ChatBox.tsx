"use client";

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Gamepad, Users, Shield, Award } from 'lucide-react';
import { ChatMessage, Profile } from '../types';
import { db } from '../services/db';

interface ChatBoxProps {
  currentUser: Profile;
  tournamentId: string; // 'global' or a specific tournament ID
  title?: string;
}

export default function ChatBox({ currentUser, tournamentId, title = "Arena Chat" }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat messages
  const loadMessages = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const data = await db.getChatMessages(tournamentId);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load chat messages:", err);
    } finally {
      setLoading(false);
    }
  };

  // Poll for new messages every 3 seconds to simulate live chat
  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => {
      loadMessages(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    const content = inputText.trim();
    setInputText('');

    try {
      const sent = await db.sendChatMessage(
        tournamentId,
        currentUser.id,
        currentUser.username,
        currentUser.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.username}`,
        content
      );
      // Optimistically append message to state
      setMessages(prev => [...prev, sent]);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const getRoleBadge = (username: string) => {
    const nameLower = username.toLowerCase();
    if (nameLower.includes('admin')) {
      return (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-red-500/10 text-red-400 border border-red-500/20">
          <Shield className="h-2 w-2" /> Admin
        </span>
      );
    }
    if (nameLower.includes('organizer') || nameLower.includes('host')) {
      return (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Award className="h-2 w-2" /> Org
        </span>
      );
    }
    return (
      <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        Player
      </span>
    );
  };

  return (
    <div className="flex flex-col h-[500px] rounded-2xl border border-white/5 bg-[#0b0c10]/80 overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-zinc-950/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">{title}</h4>
            <p className="text-[10px] text-zinc-500 font-medium">
              {tournamentId === 'global' ? 'Lounge Chatroom • General Discussion' : 'Tournament Lobby • Registered Competitors'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 bg-white/5 px-2 py-1 rounded-md font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
          Live
        </div>
      </div>

      {/* Chat Scroll Pane */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 scrollbar-thin scrollbar-thumb-zinc-800"
      >
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            <p className="text-[10px] text-zinc-500">Retrieving conversation logs...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
            <p className="text-xs font-bold text-zinc-400">Welcome to the lobby! 👋</p>
            <p className="text-[10px] text-zinc-500 max-w-xs">Be the first to post a message. Good sportsmanship is appreciated!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUser.id;
            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 text-left ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <img 
                  src={msg.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${msg.username}`} 
                  alt="" 
                  className="h-8 w-8 rounded-lg bg-zinc-900 border border-white/5 object-cover self-start"
                />

                {/* Message Bubble Container */}
                <div className={`max-w-[75%] space-y-1 ${isMe ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-zinc-200">{msg.username}</span>
                    {getRoleBadge(msg.username)}
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-all ${
                    isMe 
                      ? 'bg-gradient-to-br from-cyan-600/20 to-indigo-600/20 border border-cyan-500/20 text-zinc-200 rounded-tr-none' 
                      : 'bg-[#161a22]/80 border border-white/5 text-zinc-300 rounded-tl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-white/5 bg-zinc-950/40 flex gap-2 items-center">
        <input 
          type="text" 
          placeholder="Send a message to the arena..." 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={400}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/40 transition-all text-left"
        />
        <button 
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-2.5 bg-cyan-500 text-black rounded-xl hover:bg-cyan-400 disabled:opacity-30 disabled:hover:bg-cyan-500 transition-colors cursor-pointer flex items-center justify-center"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
