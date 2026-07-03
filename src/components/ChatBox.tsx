"use client";

import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Search, Shield, Award, ImagePlus, Paperclip, Sparkles, Camera, CheckCheck } from 'lucide-react';
import { Reply, Eye, Video } from 'lucide-react';
import { ChatMessage, Profile } from '../types';
import { db } from '../services/db';
import { useToast } from './Toast';
import { supabase, isSupabaseConfigured } from '../supabase';

interface ChatBoxProps {
  currentUser: Profile;
  tournamentId: string; // 'global' or a specific tournament ID
  title?: string;
  profiles?: Profile[];
  defaultRecipientId?: string;
  hostId?: string;
  allowedRecipientIds?: string[];
  simpleMode?: boolean;
}

export default function ChatBox({ currentUser, tournamentId, title = "Tournament Chat", profiles = [], defaultRecipientId, hostId, allowedRecipientIds, simpleMode = false }: ChatBoxProps) {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(defaultRecipientId || (tournamentId === 'global' ? 'global' : 'tournament'));
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const [openedEphemeralMessages, setOpenedEphemeralMessages] = useState<Record<string, string>>({});
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, { count: number; byUser: string[] }>>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const availableRecipients = profiles
    .filter(profile => profile.id !== currentUser.id)
    .filter(profile => !allowedRecipientIds || allowedRecipientIds.includes(profile.id))
    .filter(profile => profile.username.toLowerCase().includes(recipientSearch.toLowerCase()));
  const channelRecipients = tournamentId === 'global'
    ? [{ id: 'global', username: 'Global Chat Lobby' }, ...availableRecipients]
    : [{ id: 'tournament', username: 'Tournament Chat' }, ...availableRecipients];

  const quickReplies = ['Let’s go!', 'Ready', 'Need a rematch', 'Great game'];
  const showAttachmentControls = !simpleMode;
  const showTypingAndSearch = !simpleMode;

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
      // load reactions for the channel
      try {
        const ids = (data || []).map((m: any) => m.id);
        const r = await db.getReactionsForChannel(activeChannelId, ids);
        setReactionsMap(r);
      } catch (e) {
        console.warn('Failed to load reactions:', e);
      }

      if (activeChannelId.startsWith('dm:')) {
        await db.markChatRead(activeChannelId, currentUser.id);
      }
      // load typing users
      try {
        const t = await db.getTypingUsers(activeChannelId);
        setTypingUsers(t.filter(id => id !== currentUser.id));
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEphemeralMessage = async (msg: ChatMessage) => {
    try {
      setOpenedEphemeralMessages((prev) => ({ ...prev, [msg.id]: msg.content }));
      setMessages((prev) => prev.filter((existing) => existing.id !== msg.id));
      await db.deleteChatMessage(msg.id);
    } catch (err) {
      console.warn('Failed to delete opened ephemeral message:', err);
    }
  };

  useEffect(() => {
    setOpenedEphemeralMessages({});
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId.startsWith('dm:')) return;

    return () => {
      const hiddenEphemeralMessages = messagesRef.current.filter((msg) => {
        if (msg.user_id === currentUser.id) return false;
        try {
          const payload = JSON.parse(msg.content || '{}');
          return payload?.ephemeral;
        } catch {
          return false;
        }
      });
      hiddenEphemeralMessages.forEach((msg) => {
        db.deleteChatMessage(msg.id).catch(() => {});
      });
    };
  }, [activeChannelId, currentUser.id]);

  useEffect(() => {
    if (tournamentId === 'global' && !activeChannelId) return;

    loadMessages();
    const interval = setInterval(() => {
      loadMessages(true);
    }, 3000);
    const typingInterval = setInterval(() => {
      db.getTypingUsers(activeChannelId).then(t => setTypingUsers(t.filter(id => id !== currentUser.id))).catch(() => {});
    }, 2000);
    return () => { clearInterval(interval); clearInterval(typingInterval); };
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
      let payloadObj: any = {};
      if (selectedFile) {
        setIsUploadingMedia(true);
        const mediaUrl = await uploadChatMedia(selectedFile);
        payloadObj = { type: mediaType === 'video' ? 'video' : 'image', url: mediaUrl, caption: textContent };
      } else {
        payloadObj = { type: 'text', text: textContent };
      }

      if (replyTo) payloadObj.reply_to = replyTo.id;
      if (viewOnce) payloadObj.ephemeral = true;

      const payload = JSON.stringify(payloadObj);

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
      setMediaType(null);
      setReplyTo(null);
      setViewOnce(false);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.show('Failed to send message. Please try again.', 'error');
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
    if (file.type.startsWith('video/')) setMediaType('video');
    else setMediaType('image');
    event.target.value = '';
  };

  // Typing indicator: ping the server when input changes
  useEffect(() => {
    if (!activeChannelId) return;
    if (!inputText) return;
    const t = setTimeout(() => {
      db.setTyping(activeChannelId, currentUser.id).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [inputText, activeChannelId]);

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await db.toggleChatReaction(messageId, currentUser.id, emoji);
      const ids = messages.map(m => m.id);
      const r = await db.getReactionsForChannel(activeChannelId, ids);
      setReactionsMap(r);
    } catch (e) {
      console.warn('Failed to toggle reaction:', e);
    }
  };

  const renderMessageContent = (content: string, isEphemeralOpen = false) => {
    try {
      const payload = JSON.parse(content);
      const replyPreview = payload?.reply_to ? messages.find(m => m.id === payload.reply_to) : null;
      const renderReply = replyPreview ? (
        <div className="mb-2 rounded-lg border border-white/5 bg-black/20 p-2 text-[11px] text-zinc-300">
          <strong className="text-[10px] text-zinc-200">Reply to {replyPreview.username}:</strong>
          <div className="truncate text-[11px] text-zinc-300">{JSON.parse(replyPreview.content || '""')?.text || replyPreview.content}</div>
        </div>
      ) : null;
      if (payload?.type === 'image' && payload.url) {
        return (
          <div className="space-y-2">
            {renderReply}
            <img src={payload.url} alt={payload.caption || 'Shared photo'} className="max-h-56 rounded-xl border border-white/10 object-cover" />
            {payload.caption ? <p className="text-[11px] text-zinc-200">{payload.caption}</p> : null}
          </div>
        );
      }
      if (payload?.type === 'video' && payload.url) {
        return (
          <div className="space-y-2">
            {renderReply}
            <video src={payload.url} controls className="max-h-72 rounded-xl border border-white/10 object-cover" />
            {payload.caption ? <p className="text-[11px] text-zinc-200">{payload.caption}</p> : null}
          </div>
        );
      }
      if (payload?.type === 'text' && typeof payload.text === 'string') {
        return (
          <div className={isEphemeralOpen ? 'select-none' : undefined} style={isEphemeralOpen ? { WebkitUserSelect: 'none' as const, userSelect: 'none' as const } : undefined}>
            {replyPreview ? (
              <div className="mb-2 rounded-lg border border-white/5 bg-black/20 p-2 text-[11px] text-zinc-300">
                <strong className="text-[10px] text-zinc-200">Reply to {replyPreview.username}:</strong>
                <div className="truncate text-[11px] text-zinc-300">{JSON.parse(replyPreview.content || '""')?.text || replyPreview.content}</div>
              </div>
            ) : null}
            <span className="whitespace-pre-wrap">{payload.text}</span>
          </div>
        );
      }
    } catch {
      // Fall back to plain text.
    }

    return (
      <span
        className={isEphemeralOpen ? 'select-none whitespace-pre-wrap' : 'whitespace-pre-wrap'}
        style={isEphemeralOpen ? { WebkitUserSelect: 'none' as const, userSelect: 'none' as const } : undefined}
        onCopy={(e) => {
          if (isEphemeralOpen) e.preventDefault();
        }}
      >
        {content}
      </span>
    );
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
        {showTypingAndSearch && (
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={recipientSearch}
              onChange={(e) => setRecipientSearch(e.target.value)}
              placeholder={allowedRecipientIds ? 'Search friends' : 'Search users'}
              className="w-full rounded-xl border border-white/10 bg-black/30 py-1.5 pl-8 pr-2 text-xs text-zinc-200 placeholder-zinc-500"
            />
          </div>
        )}
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

                  {(() => {
                    const isHiddenEphemeral = (() => {
                      if (!activeChannelId.startsWith('dm:')) return false;
                      try {
                        const payload = JSON.parse(msg.content || '{}');
                        return payload?.ephemeral && msg.user_id !== currentUser.id && !openedEphemeralMessages[msg.id];
                      } catch {
                        return false;
                      }
                    })();

                    if (isHiddenEphemeral) {
                      return (
                        <div className="rounded-2xl border border-dashed border-amber-500/30 bg-[#0f1117]/90 p-4 text-sm text-zinc-300">
                          <p className="font-semibold text-white">View once message</p>
                          <p className="mt-2 text-[11px] text-zinc-500">This message is hidden until you open it. It will disappear once you leave this chat.</p>
                          <button
                            type="button"
                            onClick={() => handleOpenEphemeralMessage(msg)}
                            className="mt-3 inline-flex rounded-full bg-amber-500 px-3 py-2 text-xs font-semibold text-black"
                          >
                            Open once
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className={`rounded-2xl p-3 text-xs leading-relaxed shadow-lg ${
                        isMe
                          ? 'border border-cyan-500/20 bg-linear-to-br from-cyan-600/20 to-indigo-600/20 text-zinc-100 rounded-tr-none'
                          : 'border border-white/10 bg-[#161a22]/90 text-zinc-300 rounded-tl-none'
                      }`}>
                        {renderMessageContent(msg.content, Boolean(openedEphemeralMessages[msg.id]))}
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-2 mt-1">
                    {showAttachmentControls && (
                      <button type="button" onClick={() => setReplyTo(msg)} className="text-[10px] text-zinc-400 hover:text-cyan-300">Reply</button>
                    )}
                    {!isMe && showAttachmentControls ? (
                      <button type="button" onClick={() => setViewOnce(true)} className="text-[10px] text-zinc-400 hover:text-cyan-300">View once</button>
                    ) : null}
                  </div>

                  {showAttachmentControls && (
                    <div className="flex items-center gap-2 mt-1">
                      {/* Existing reactions */}
                      {Object.entries(reactionsMap[msg.id] || {}).map(([emoji, info]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleToggleReaction(msg.id, emoji)}
                          className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${info.byUser.includes(currentUser.id) ? 'bg-cyan-600/20 text-cyan-200' : 'bg-white/5 text-zinc-300'}`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px]">{info.count}</span>
                        </button>
                      ))}

                      {/* Quick add reactions */}
                      {['👍','❤️','🔥','😂','🎉'].map(e => (
                        <button key={e} type="button" onClick={() => handleToggleReaction(msg.id, e)} className="text-[13px] text-zinc-400 hover:text-cyan-300">{e}</button>
                      ))}
                    </div>
                  )}
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
{showAttachmentControls && (
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
        )}

        {showAttachmentControls && replyTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
            <div className="min-w-0 flex-1 text-[11px] text-zinc-300">
              Replying to <strong className="text-zinc-100">{replyTo.username}</strong>: {JSON.parse(replyTo.content || '""')?.text || replyTo.content}
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="text-[10px] font-semibold text-cyan-300">Cancel</button>
          </div>
        ) : null}

        {showAttachmentControls && (
          <div className="mb-2 flex items-center gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-8 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-zinc-300">
              <Paperclip className="h-4 w-4" /> Attach
            </button>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
              <input type="checkbox" checked={viewOnce} onChange={() => setViewOnce(v => !v)} /> <span>View once</span>
            </label>
          </div>
        )}
        {showAttachmentControls && attachmentPreview ? (
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
          {showAttachmentControls && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-cyan-500/30 hover:text-cyan-300"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </>
          )}
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
