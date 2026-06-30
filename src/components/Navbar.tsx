import { useState, useEffect } from 'react';
import { Trophy, Bell, Shield, LogOut, Check, ChevronDown, Gamepad2 } from 'lucide-react';
import { Profile, Notification } from '../types';
import { db } from '../services/db';

interface NavbarProps {
  currentUser: Profile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: Notification[];
  onRefreshNotifications: () => void;
}

export default function Navbar({ 
  currentUser, 
  activeTab, 
  setActiveTab, 
  notifications,
  onRefreshNotifications 
}: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = async (id: string) => {
    await db.markNotificationAsRead(id);
    onRefreshNotifications();
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/40 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-black font-extrabold shadow-[0_0_20px_rgba(6,182,212,0.4)]">
              <Trophy className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              KICK<span className="text-cyan-400">OFF</span>
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            {[
              { id: 'dashboard', name: 'Dashboard' },
              { id: 'tournaments', name: 'Tournaments' },
              { id: 'leaderboard', name: 'Leaderboard' },
              { id: 'achievements', name: 'Achievements' },
              { id: 'settings', name: 'Settings' }
            ].map((tab) => (
              <button
                key={tab.id}
                id={`nav-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
                  activeTab === tab.id
                    ? 'text-cyan-400 bg-white/5 border border-white/10 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.name}
              </button>
            ))}

            {/* Organizer Hub for Organizers/Admins */}
            {(currentUser.role === 'organizer' || currentUser.role === 'admin') && (
              <button
                id="nav-organizer"
                onClick={() => setActiveTab('organizer')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all duration-200 rounded-lg border border-cyan-500/30 ${
                  activeTab === 'organizer'
                    ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'text-cyan-400 hover:bg-cyan-500/10'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Organizer Hub
              </button>
            )}
          </div>

          {/* Notifications & Profile Trays */}
          <div className="flex items-center gap-4">
            
            {/* Notification Bell */}
            <div className="relative">
              <button
                id="bell-button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors relative"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-cyan-500 ring-2 ring-black animate-pulse" />
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 rounded-xl border border-white/10 bg-[#0b0b0f] p-4 shadow-2xl ring-1 ring-black ring-opacity-5 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                    <span className="font-semibold text-white text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-medium">
                        {unreadCount} New
                      </span>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-4">No notifications yet.</p>
                    ) : (
                      notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className={`p-2.5 rounded-lg text-xs transition-colors ${
                            notification.is_read ? 'bg-zinc-950/30' : 'bg-cyan-500/5 border border-cyan-500/10'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-zinc-200">{notification.title}</span>
                            {!notification.is_read && (
                              <button 
                                onClick={() => handleMarkRead(notification.id)}
                                className="text-cyan-400 hover:text-cyan-300 transition-colors"
                                title="Mark as read"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-zinc-400 mt-1">{notification.content}</p>
                          <span className="text-[10px] text-zinc-500 block mt-1.5">
                            {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                id="profile-menu-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <img
                  src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=user'}
                  alt={currentUser.username}
                  className="h-8 w-8 rounded-lg bg-zinc-900 object-cover ring-1 ring-cyan-500/20"
                />
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-none mb-0.5">{currentUser.username}</p>
                  <p className="text-[10px] text-cyan-400 capitalize flex items-center gap-1 font-medium">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    {currentUser.role}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              </button>

              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-52 rounded-xl border border-white/10 bg-[#0b0b0f] p-1.5 shadow-2xl ring-1 ring-black ring-opacity-5 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="px-3 py-2 border-b border-white/5 mb-1">
                    <p className="text-xs text-zinc-400">Signed in as</p>
                    <p className="text-sm font-bold text-white truncate">{currentUser.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors text-left"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('achievements');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors text-left"
                  >
                    My Achievements
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      alert('To logout completely, please clear local credentials.');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </nav>
  );
}
