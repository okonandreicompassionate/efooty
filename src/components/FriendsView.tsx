import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { Check, MessageSquare, Search, UserPlus, X } from 'lucide-react';
import { Friendship, Profile } from '../types';
import { db } from '../services/db';
import { useToast } from './Toast';

interface FriendsViewProps {
  currentUser: Profile;
  profiles: Profile[];
  setActiveTab: (tab: string) => void;
}

export default function FriendsView({ currentUser, profiles, setActiveTab }: FriendsViewProps) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const normalizedSearch = search.trim().toLowerCase();

  const loadFriendships = async () => {
    try {
      setLoading(true);
      setFriendships(await db.getFriendships(currentUser.id));
    } catch (err) {
      console.error('Failed to load friends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFriendships();
  }, [currentUser.id]);

  const toast = useToast();

  const profileById = useMemo(() => new Map(profiles.map(profile => [profile.id, profile])), [profiles]);

  const getOtherUserId = (friendship: Friendship) =>
    friendship.requester_id === currentUser.id ? friendship.addressee_id : friendship.requester_id;

  const acceptedFriends = friendships.filter(friendship => friendship.status === 'accepted');
  const incomingRequests = friendships.filter(friendship => friendship.status === 'pending' && friendship.addressee_id === currentUser.id);
  const outgoingRequests = friendships.filter(friendship => friendship.status === 'pending' && friendship.requester_id === currentUser.id);
  const existingUserIds = new Set(friendships.map(getOtherUserId));

  const searchResults = profiles
    .filter(profile => profile.id !== currentUser.id)
    .filter(profile => !existingUserIds.has(profile.id))
    .filter(profile => {
      if (!normalizedSearch) return true;
      const searchableText = `${profile.username ?? ''} ${profile.email ?? ''} ${profile.role ?? ''}`.toLowerCase();
      return searchableText.includes(normalizedSearch);
    })
    .slice(0, 8);

  const sendRequest = async (profileId: string) => {
    try {
      await db.sendFriendRequest(currentUser.id, profileId);
      setMessage('Friend request sent.');
      toast.show('Friend request sent.', 'success');
      await loadFriendships();
    } catch (err: any) {
      console.error('Could not send friend request:', err);
      const message = 'Could not send friend request.';
      setMessage(message);
      toast.show(message, 'error');
    }
  };

  const updateStatus = async (friendshipId: string, status: Friendship['status']) => {
    try {
      await db.updateFriendshipStatus(friendshipId, status);
      const successMsg = status === 'accepted' ? 'Friend request accepted.' : 'Request updated.';
      setMessage(successMsg);
      toast.show(successMsg, 'success');
      await loadFriendships();
    } catch (err: any) {
      console.error('Could not update friend request:', err);
      const message = 'Could not update friend request.';
      setMessage(message);
      toast.show(message, 'error');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    try {
      await db.removeFriendship(friendshipId);
      const msg = 'Friend connection removed.';
      setMessage(msg);
      toast.show(msg, 'success');
      await loadFriendships();
    } catch (err: any) {
      console.error('Could not remove friend:', err);
      const message = 'Could not remove friend.';
      setMessage(message);
      toast.show(message, 'error');
    }
  };

  const renderProfileRow = (profile: Profile, action: React.ReactNode) => (
    <div key={profile.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/45 px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={profile.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${profile.username}`}
          alt=""
          className="h-9 w-9 rounded-lg bg-zinc-950 object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{profile.username}</p>
          <p className="text-[10px] capitalize text-zinc-500">{profile.role}</p>
        </div>
      </div>
      {action}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
      <div className="rounded-[28px] border border-white/10 bg-zinc-950/60 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-400">Social hub</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Friends</h1>
          </div>
          <p className="max-w-xl text-sm text-zinc-400">Find players, manage requests, and keep your match contacts close at hand.</p>
        </div>
      </div>

      {message && <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-[24px] border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300">
                <Search className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Find Players</h2>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or email"
              className="mb-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-cyan-500/40"
            />
            <div className="space-y-2">
              {!search.trim() ? (
                <p className="text-xs text-zinc-500">Type a username to discover players.</p>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-zinc-500">No new players found for that search.</p>
              ) : (
                searchResults.map(profile => renderProfileRow(profile, (
                  <button onClick={() => sendRequest(profile.id)} className="flex items-center gap-1 rounded-lg bg-cyan-500 px-2.5 py-1.5 text-xs font-semibold text-black">
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </button>
                )))
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-white">My Friends</h2>
            <div className="space-y-2">
              {loading ? (
                <p className="text-xs text-zinc-500">Loading friends...</p>
              ) : acceptedFriends.length === 0 ? (
                <p className="text-xs text-zinc-500">Accepted friends will appear here.</p>
              ) : (
                acceptedFriends.map(friendship => {
                  const profile = profileById.get(getOtherUserId(friendship));
                  if (!profile) return null;
                  return renderProfileRow(profile, (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveTab('messages')} className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2 text-cyan-300" title="Open DMs">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeFriend(friendship.id)} className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300" title="Remove friend">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ));
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-white">Incoming Requests</h2>
            <div className="space-y-2">
              {incomingRequests.length === 0 ? (
                <p className="text-xs text-zinc-500">No pending requests.</p>
              ) : (
                incomingRequests.map(friendship => {
                  const profile = profileById.get(friendship.requester_id);
                  if (!profile) return null;
                  return renderProfileRow(profile, (
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateStatus(friendship.id, 'accepted')} className="rounded-lg bg-cyan-500 p-2 text-black" title="Accept">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeFriend(friendship.id)} className="rounded-lg border border-white/10 p-2 text-zinc-300" title="Decline">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ));
                })
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-zinc-950/60 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-white">Sent Requests</h2>
            <div className="space-y-2">
              {outgoingRequests.length === 0 ? (
                <p className="text-xs text-zinc-500">No outgoing requests waiting.</p>
              ) : (
                outgoingRequests.map(friendship => {
                  const profile = profileById.get(friendship.addressee_id);
                  if (!profile) return null;
                  return renderProfileRow(profile, (
                    <button onClick={() => removeFriend(friendship.id)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-300">
                      Cancel
                    </button>
                  ));
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
