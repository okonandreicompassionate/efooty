import { useMemo, useState, useEffect } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import { Profile } from '../types';
import { db } from '../services/db';
import ChatBox from './ChatBox';

interface MessagesViewProps {
  currentUser: Profile;
  profiles: Profile[];
  defaultRecipientId?: string;
}

export default function MessagesView({ currentUser, profiles, defaultRecipientId }: MessagesViewProps) {
  const [selectedRecipientId, setSelectedRecipientId] = useState(defaultRecipientId || '');
  const [search, setSearch] = useState('');
  const [friendIds, setFriendIds] = useState<string[]>([]);

  const normalizedSearch = search.trim().toLowerCase();

  useEffect(() => {
    const loadFriendIds = async () => {
      try {
        const friendIds = await db.getAcceptedFriendIds(currentUser.id);
        setFriendIds(friendIds);
      } catch (err) {
        console.error('Failed to load friend IDs for DM search:', err);
      }
    };
    loadFriendIds();
  }, [currentUser.id]);

  const results = useMemo(() => profiles
    .filter(profile => profile.id !== currentUser.id)
    .filter(profile => friendIds.includes(profile.id))
    .filter(profile => {
      if (!normalizedSearch) return true;
      const searchableText = `${profile.username ?? ''} ${profile.email ?? ''} ${profile.role ?? ''}`.toLowerCase();
      return searchableText.includes(normalizedSearch);
    })
    .slice(0, 10), [profiles, currentUser.id, normalizedSearch, friendIds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-400">Private comms</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Messages</h1>
          </div>
          <p className="max-w-xl text-sm text-zinc-400">Search players, start a DM, and keep every match conversation close by.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <div className="space-y-4">
          <ChatBox
            currentUser={currentUser}
            tournamentId="global"
            profiles={profiles}
            title="Direct Messages"
            defaultRecipientId={selectedRecipientId || defaultRecipientId}
            allowedRecipientIds={friendIds}
          />
        </div>

        <div className="rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300">
              <Search className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Find User</h3>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username or email"
            className="mb-4 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none ring-0 transition focus:border-cyan-500/40"
          />
          <div className="space-y-2">
            {normalizedSearch && results.length === 0 ? (
              <p className="rounded-2xl border border-white/5 bg-white/5 px-3 py-3 text-xs text-zinc-500">No users found for that search.</p>
            ) : !normalizedSearch && friendIds.length === 0 ? (
              <p className="rounded-2xl border border-white/5 bg-white/5 px-3 py-3 text-xs text-zinc-500">Add friends first to start direct messages.</p>
            ) : (
              results.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedRecipientId(profile.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left transition-all ${
                    selectedRecipientId === profile.id ? 'border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]' : 'border-white/5 bg-zinc-900/40 hover:bg-white/5'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <img src={profile.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${profile.username}`} alt="" className="h-9 w-9 rounded-xl bg-zinc-950 object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">{profile.username}</span>
                      <span className="block text-[10px] capitalize text-zinc-500">{profile.role}</span>
                    </span>
                  </span>
                  <MessageSquare className="h-4 w-4 text-cyan-400" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
