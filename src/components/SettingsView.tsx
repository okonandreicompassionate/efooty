import { useState, useEffect } from 'react';
import { Settings, User, Bell, Shield, Save, CheckCircle } from 'lucide-react';
import { Profile, Settings as UserSettings } from '../types';
import { db } from '../services/db';

interface SettingsViewProps {
  currentUser: Profile;
  onRefreshProfile: () => void;
}

export default function SettingsView({ currentUser, onRefreshProfile }: SettingsViewProps) {
  // Profile settings
  const [bio, setBio] = useState(currentUser.bio || '');
  const [username, setUsername] = useState(currentUser.username);
  
  // Toggles settings
  const [pushNotif, setPushNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [allowDms, setAllowDms] = useState(true);
  const [anonymousMode, setAnonymousMode] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Load existing settings
    async function fetchSettings() {
      try {
        const setts = await db.getSettings(currentUser.id);
        setPushNotif(setts.push_notifications);
        setEmailNotif(setts.email_notifications);
        setPublicProfile(setts.public_profile);
        setShowEmail(Boolean(setts.show_email));
        setAllowDms(setts.allow_dms !== false);
        setAnonymousMode(Boolean(setts.anonymous_mode));
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    }
    fetchSettings();
  }, [currentUser.id]);

  const handleSave = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      // Save profile update
      const normalizedUsername = username.trim().replace(/\s+/g, '_').toLowerCase();
      if (normalizedUsername.length < 3) {
        alert('Username must be at least 3 characters.');
        return;
      }

      await db.updateUserProfile(currentUser.id, {
        username: normalizedUsername,
        bio
      });

      // Save toggles update
      await db.updateSettings(currentUser.id, {
        push_notifications: pushNotif,
        email_notifications: emailNotif,
        public_profile: publicProfile,
        show_email: showEmail,
        allow_dms: allowDms,
        anonymous_mode: anonymousMode
      });

      onRefreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Saving failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300 text-left">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Profile & Preferences</h1>
        <p className="text-sm text-zinc-400">Configure your public gamer biography, notification triggers, and client rules.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Profile Card */}
        <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-6 space-y-4 backdrop-blur-sm">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-white/5">
            <User className="h-4 w-4 text-cyan-400" />
            Public Biography
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <img 
              src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + currentUser.id} 
              alt="" 
              className="h-16 w-16 rounded-xl bg-zinc-900 border border-cyan-500/10 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-sm font-bold text-white">Gamer Avatar</p>
              <p className="text-xs text-zinc-400">Profile icon synced dynamically from public pixel library.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Gamer Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Email Address</label>
              <input 
                type="email" 
                value={currentUser.email} 
                disabled
                className="w-full bg-zinc-900/60 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-zinc-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">Biography Bio</label>
            <textarea 
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. Tekken competitive main. Playing to claim regional champion crowns."
              className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-650 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            />
          </div>
        </div>

        {/* Preferences / Toggles */}
        <div className="rounded-2xl border border-white/5 bg-zinc-950/40 p-6 space-y-4 backdrop-blur-sm">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 pb-3 border-b border-white/5">
            <Bell className="h-4 w-4 text-cyan-400" />
            Client & Notifications Preferences
          </h3>

          <div className="space-y-4">
            {[
              { id: 'push', title: 'Push Notifications', desc: 'Alert me instantly in client browser when my tournament bracket has generated.', checked: pushNotif, setter: setPushNotif },
              { id: 'email', title: 'Email Notifications', desc: 'Send daily digests of match scorecard results and leaderboard point changes.', checked: emailNotif, setter: setEmailNotif },
              { id: 'public', title: 'Public Gamer Profile', desc: 'Allow other registered tournament participants to view my historical statistics and achievements.', checked: publicProfile, setter: setPublicProfile },
              { id: 'show-email', title: 'Show Email', desc: 'Let other players see your email on player cards and tournament rosters.', checked: showEmail, setter: setShowEmail },
              { id: 'allow-dms', title: 'Allow Direct Messages', desc: 'Let players search for you and start private conversations.', checked: allowDms, setter: setAllowDms },
              { id: 'anonymous', title: 'Anonymous Mode', desc: 'Show a privacy-first identity where supported by player lists and public surfaces.', checked: anonymousMode, setter: setAnonymousMode }
            ].map(pref => (
              <div key={pref.id} className="flex items-start justify-between gap-4">
                <div className="space-y-1 text-left max-w-md">
                  <h4 className="text-xs font-bold text-zinc-200">{pref.title}</h4>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">{pref.desc}</p>
                </div>

                <button
                  type="button"
                  onClick={() => pref.setter(!pref.checked)}
                  className={`w-11 h-6 rounded-full transition-all relative flex items-center p-0.5 cursor-pointer ${
                    pref.checked ? 'bg-cyan-500' : 'bg-zinc-800'
                  }`}
                >
                  <span className={`h-5 w-5 rounded-full bg-zinc-950 shadow transition-all transform ${
                    pref.checked ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-semibold h-8">
            {success && (
              <span className="flex items-center gap-1 animate-fade-in">
                <CheckCircle className="h-4 w-4" />
                Settings saved successfully!
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>

      </form>
    </div>
  );
}
