"use client";

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Search, Shield, Award, ImagePlus, Paperclip, Sparkles, Camera, CheckCheck } from 'lucide-react';
import { ChatMessage, Profile } from '../types';
import { db } from '../services/db';
import { supabase, isSupabaseConfigured } from '../supabase';

interface ChatBoxProps {
  currentUser: Profile;
  tournamentId: string; // 'global' or a specific tournament ID
  title?: string;
  profiles?: Profile[];
  defaultRecipientId?: string;
  hostId?: string;
}

export default function ChatBox({ currentUser, tournamentId, title = "Arena Chat", profiles = [], defaultRecipientId, hostId }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(defaultRecipientId || (tournamentId === 'global' ? 'global' : 'tournament'));
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableRecipients = profiles
    .filter(profile => profile.id !== currentUser.id)
    .filter(profile => profile.username.toLowerCase().includes(recipientSearch.toLowerCase()));
  const channelRecipients = tournamentId === 'global'
    ? [{ id: 'global', username: 'Global Chat Lobby' }, ...availableRecipients]
    : [{ id: 'tournament', username: 'Tournament Chat' }, ...availableRecipients];

  const quickReplies = ['Let’s go!', 'Ready', 'Need a rematch', 'Great game'];

  const getDmChannelId = (userA: string, userB: string) => {
    if (!userA || !userB) return '';
    return `dm:${[userA, userB].sort().join(':')}`;
  };

  const effectiveRecipientId = selectedRecipientId || (tournamentId === 'global' ? 'global' : 'tournament');
  const isDmMode = effectiveRecipientId !== 'global' && effectiveRecipientId !== 'tournament' && Boolean(effectiveRecipientId);
  const activeChannelId = isDmMode
    ? getDmChannelId(currentUser.id, effectiveRecipientId)
    : (tournamentId === 'global' ? 'global' : tournamentId);

  const selectedRecipient = effectiveRecipientId === 'global' || effectiveRecipientId === 'tournament'
    ? null
    : profiles.find(profile => profile.id === effectiveRecipientId);

  const activeTitle = isDmMode && selectedRecipient
    ? `DM with ${selectedRecipient.username}`
    : title;

  useEffect(() => {
    if (defaultRecipientId && defaultRecipientId !== selectedRecipientId) {
      setSelectedRecipientId(defaultRecipientId);
    } else if (!defaultRecipientId && tournamentId === 'global' && selectedRecipientId !== 'global') {
      setSelectedRecipientId('global');
    } else if (!defaultRecipientId && tournamentId !== 'global' && selectedRecipientId !== 'tournament') {
      setSelectedRecipientId('tournament');
    }
  }, [defaultRecipientId, tournamentId, selectedRecipientId]);

  useEffect(() => {
    if (attachmentPreview?.startsWith('blob:')) {
      return () => URL.revokeObjectURL(attachmentPreview);
    }
  }, [attachmentPreview]);

  const loadMessages = async (quiet = false) => {
    try {
      if (!quiet) setLoading(true);
      const data = await db.getChatMessages(activeChannelId);
      setMessages(data);
      if (activeChannelId.startsWith('dm:')) {
        await db.markChatRead(activeChannelId, currentUser.id);
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tournamentId === 'global' && !activeChannelId) return;

    loadMessages();
    const interval = setInterval(() => {
      loadMessages(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeChannelId, tournamentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const uploadChatMedia = async (file: File) => {
    if (!supabase || !isSupabaseConfigured) {
      throw new Error('Photo upload is not configured yet.');
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const storagePath = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('proof-screenshots').upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false
    });

    if (error) throw error;

    const { data: publicData } = supabase.storage.from('proof-screenshots').getPublicUrl(storagePath);
    return publicData.publicUrl;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || isSending || isUploadingMedia || !activeChannelId) return;

    setIsSending(true);
    const textContent = inputText.trim();
    setInputText('');

    try {
      let payload: string;
      if (selectedFile) {
        setIsUploadingMedia(true);
        const imageUrl = await uploadChatMedia(selectedFile);
        payload = JSON.stringify({ type: 'image', url: imageUrl, caption: textContent });
      } else {
        payload = JSON.stringify({ type: 'text', text: textContent });
      }

      const sent = await db.sendChatMessage(
        activeChannelId,
        currentUser.id,
        currentUser.username,
        currentUser.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUser.username}`,
        payload
      );
      setMessages(prev => [...prev, sent]);
      setSelectedFile(null);
      setAttachmentPreview(null);
    } catch (err) {
      console.error('Failed to send message:', err);
      alert(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setIsSending(false);
      setIsUploadingMedia(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setAttachmentPreview(URL.createObjectURL(file));
    event.target.value = '';
  };

  const renderMessageContent = (content: string) => {
    try {
      const payload = JSON.parse(content);
      if (payload?.type === 'image' && payload.url) {
        return (
          <div className="space-y-2">
            <img src={payload.url} alt={payload.caption || 'Shared photo'} className="max-h-56 rounded-xl border border-white/10 object-cover" />
            {payload.caption ? <p className="text-[11px] text-zinc-200">{payload.caption}</p> : null}
          </div>
        );
      }
      if (payload?.type === 'text' && typeof payload.text === 'string') {
        return <span className="whitespace-pre-wrap">{payload.text}</span>;
      }
    } catch {
      // Fall back to plain text.
    }

    return <span className="whitespace-pre-wrap">{content}</span>;
  };

  const getRoleBadge = (userId: string) => {
    const profile = profiles.find(p => p.id === userId);
    if (hostId && userId === hostId) {
      return (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Award className="h-2 w-2" /> Host
        </span>
      );
    }
    if (profile?.role === 'admin') {
      return (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-red-500/10 text-red-400 border border-red-500/20">
          <Shield className="h-2 w-2" /> Admin
        </span>
      );
    }
    if (profile?.role === 'organizer') {
      return (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Award className="h-2 w-2" /> Organizer
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
    <div className="flex flex-col h-140 rounded-3xl border border-white/10 bg-[#07090d]/90 overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 bg-linear-to-r from-zinc-950/90 via-zinc-900/80 to-cyan-950/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-white">{activeTitle}</h4>
            <p className="text-[10px] text-zinc-400">
              {isDmMode && selectedRecipient
                ? `Private channel • ${selectedRecipient.username}`
                : tournamentId === 'global'
                  ? 'Lobby • fast DMs • live updates'
                  : 'Tournament chat • team updates'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Live
        </div>
      </div>

      <div className="flex flex-col gap-2 border-b border-white/10 bg-zinc-950/40 px-3 py-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">
          <Sparkles className="h-3 w-3" /> channel
        </div>
        <select
          value={selectedRecipientId}
          onChange={(e) => setSelectedRecipientId(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-zinc-200"
        >
          {channelRecipients.length > 0 ? (
            channelRecipients.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.username}</option>
            ))
          ) : (
            <option value="global" disabled>No available recipients</option>
          )}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={recipientSearch}
            onChange={(e) => setRecipientSearch(e.target.value)}
            placeholder="Search users"
            className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 pl-8 pr-2 text-xs text-zinc-200 placeholder-zinc-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 min-h-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            <p className="text-[10px] text-zinc-500">Loading your conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
            <p className="text-xs font-bold text-zinc-400">{tournamentId === 'global' ? 'Start a private message' : 'Welcome to the lobby!'}</p>
            <p className="text-[10px] text-zinc-500 max-w-xs">
              {tournamentId === 'global'
                ? 'DMs, photos, and live tournament updates are all ready to go.'
                : 'Drop a note, share a score card, or send a photo to your squad.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUser.id;
            return (
              <div key={msg.id} className={`flex gap-3 text-left ${isMe ? 'flex-row-reverse' : ''}`}>
                <img
                  src={msg.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${msg.username}`}
                  alt=""
                  className="h-9 w-9 rounded-2xl border border-white/10 bg-zinc-900 object-cover self-start"
                />

                <div className={`max-w-[78%] space-y-1 ${isMe ? 'text-right' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-zinc-100">{msg.username}</span>
                    {getRoleBadge(msg.user_id)}
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className={`rounded-2xl p-3 text-xs leading-relaxed shadow-lg ${
                    isMe
                      ? 'border border-cyan-500/20 bg-linear-to-br from-cyan-600/20 to-indigo-600/20 text-zinc-100 rounded-tr-none'
                      : 'border border-white/10 bg-[#161a22]/90 text-zinc-300 rounded-tl-none'
                  }`}>
                    {renderMessageContent(msg.content)}
                  </div>
                  {isMe ? (
                    <div className="flex items-center justify-end gap-1 text-[9px] text-zinc-500">
                      <CheckCheck className="h-3 w-3" /> Sent
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-white/10 bg-zinc-950/70 px-3 py-2">
        <div className="mb-2 flex flex-wrap gap-2">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => setInputText(reply)}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-zinc-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
            >
              {reply}
            </button>
          ))}
        </div>

        {attachmentPreview ? (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2">
            <img src={attachmentPreview} alt="Preview" className="h-10 w-10 rounded-xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-cyan-200">Photo ready to send</p>
              <p className="text-[10px] text-cyan-800/70">It will be shared instantly in the chat.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setAttachmentPreview(null);
              }}
              className="text-[10px] font-semibold text-cyan-300"
            >
              Remove
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div className="flex-1">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={1}
              placeholder={tournamentId === 'global'
                ? selectedRecipient
                  ? `Message ${selectedRecipient.username}...`
                  : 'Select a recipient to start a DM'
                : 'Send a message to the arena...'}
              maxLength={400}
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/40"
              disabled={tournamentId === 'global' && !selectedRecipientId}
            />
          </div>
          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedFile) || isSending || isUploadingMedia || (tournamentId === 'global' && !selectedRecipientId)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-black transition-colors hover:bg-cyan-400 disabled:opacity-30"
          >
            {isUploadingMedia ? <Camera className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
