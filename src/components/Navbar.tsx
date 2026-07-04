import { useState, useEffect } from 'react';
import { Trophy, Bell, Shield, LogOut, Check, ChevronDown, Menu, X, MessageSquare, Users, Swords } from 'lucide-react';
import { Profile, Notification } from '../types';
import { db } from '../services/db';
import { supabase } from '../supabase';
import { useToast } from './Toast';

interface NavbarProps {
  currentUser: Profile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  notifications: Notification[];
  unreadDmCount: number;
  pendingFriendChallengesCount: number;
  onRefreshNotifications: () => void;
}

export default function Navbar({ 
  currentUser, 
  activeTab, 
  setActiveTab, 
  notifications,
  unreadDmCount,
  pendingFriendChallengesCount,
  onRefreshNotifications 
}: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const attentionCount = unreadCount + unreadDmCount + pendingFriendChallengesCount;
  const navItems = [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'tournaments', name: 'Tournaments' },
    { id: 'friendly', name: 'Friendly' },
    { id: 'messages', name: 'DMs' },
    { id: 'friends', name: 'Friends' },
    { id: 'leaderboard', name: 'Leaderboard' },
    { id: 'achievements', name: 'Achievements' },
    { id: 'settings', name: 'Settings' }
  ];
  const mobileNavItems = [
    { id: 'notifications', name: 'Notifications' },
    ...navItems
  ];

  const getNavIcon = (id: string) => {
    switch (id) {
      case 'dashboard':
        return Shield;
      case 'tournaments':
        return Trophy;
      case 'friendly':
        return Swords;
      case 'messages':
        return MessageSquare;
      case 'friends':
        return Users;
      case 'notifications':
        return Bell;
      default:
        return Shield;
    }
  };

  const visibleNavItems = navItems.slice(0, 5);
  const overflowNavItems = navItems.slice(5);

  const handleMarkRead = async (id: string) => {
    await db.markNotificationAsRead(id);
    onRefreshNotifications();
  };

  const handleNotificationClick = (notification: Notification) => {
    setShowNotifications(false);
    if (notification.link) {
      window.location.href = notification.link;
      return;
    }
    if (!notification.is_read) {
      void handleMarkRead(notification.id);
    }
  };

  const toast = useToast();

  return (
    <>
    <nav className="sticky top-0 z-40 border border-slate-200/70 bg-white/95 px-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl md:top-4 md:mx-4 md:rounded-[28px] md:border">
      <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="flex h-11 w-11 items-center justify-center rounded-3xl bg-linear-to-br from-cyan-400 via-sky-300 to-indigo-500 text-slate-950 font-extrabold shadow-[0_20px_50px_rgba(56,189,248,0.18)]">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-lg font-semibold tracking-tight text-white">eTournament</p>
              <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200/80">Modern esports hub</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-3">
            {visibleNavItems.map((tab) => (
              <button
                key={tab.id}
                id={`nav-${tab.id}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowMoreMenu(false);
                }}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-3xl ${
                  activeTab === tab.id
                    ? 'text-slate-900 bg-sky-100 border border-sky-200 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab.id === 'messages' && <MessageSquare className="h-4 w-4" />}
                {tab.id === 'friends' && <Users className="h-4 w-4" />}
                {tab.id === 'friendly' && <Swords className="h-4 w-4" />}
                <span>{tab.name}</span>
                {tab.id === 'friendly' && pendingFriendChallengesCount > 0 && (
                  <span className="ml-1 inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                )}
                {tab.id === 'messages' && unreadDmCount > 0 && (
                  <span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    {unreadDmCount > 9 ? '9+' : unreadDmCount}
                  </span>
                )}
              </button>
            ))}

            {/* More overflow menu */}
            {overflowNavItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(prev => !prev)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-3xl border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                >
                  More
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showMoreMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-3xl border border-slate-200 bg-white shadow-lg p-2">
                    {overflowNavItems.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setShowMoreMenu(false);
                        }}
                        className={`w-full text-left rounded-2xl px-3 py-2 text-sm transition ${
                          activeTab === tab.id ? 'bg-sky-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tab.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Organizer Hub for Organizers/Admins */}
            {(currentUser.role === 'organizer' || currentUser.role === 'admin') && (
              <button
                id="nav-organizer"
                onClick={() => setActiveTab('organizer')}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all duration-200 rounded-3xl border border-sky-200 ${
                  activeTab === 'organizer'
                    ? 'bg-sky-100 text-slate-900 shadow-sm'
                    : 'text-sky-700 hover:bg-slate-100'
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Organizer Hub
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="relative min-h-11 min-w-11 rounded-lg border border-gray-200 bg-white p-2 text-gray-600"
            >
              {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              {attentionCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {attentionCount > 9 ? '9+' : attentionCount}
                </span>
              )}
            </button>
          </div>

          {/* Notifications & Profile Trays */}
          <div className="flex items-center gap-4">
            
            {/* Notification Bell */}
            <div className="relative">
              <button
                id="bell-button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative min-h-11 min-w-11 rounded-3xl border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-sky-500 ring-2 ring-white animate-pulse" />
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 rounded-3xl border border-slate-200 bg-white p-4 shadow-lg ring-1 ring-slate-200 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2 mb-3">
                    <span className="font-semibold text-slate-900 text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-medium">
                        {unreadCount} New
                      </span>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No notifications yet.</p>
                    ) : (
                      notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          onClick={() => handleNotificationClick(notification)}
                          className={`cursor-pointer p-2.5 rounded-lg text-xs transition-colors ${
                            notification.is_read ? 'bg-slate-100 text-slate-700' : 'bg-cyan-50 text-slate-900 border border-cyan-100'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-slate-900">{notification.title}</span>
                            {!notification.is_read && (
                              <button 
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleMarkRead(notification.id);
                                }}
                                className="text-cyan-700 hover:text-cyan-600 transition-colors"
                                title="Mark as read"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-slate-600 mt-1">{notification.content}</p>
                          <span className="text-[10px] text-slate-400 block mt-1.5">
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
                className="flex min-h-11 items-center gap-2.5 rounded-3xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50"
              >
                <img
                  src={currentUser.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=user'}
                  alt={currentUser.username}
                  className="h-8 w-8 rounded-lg bg-gray-100 object-cover ring-1 ring-cyan-100"
                />
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-950 leading-none mb-0.5">{currentUser.username}</p>
                  <p className="text-[10px] text-cyan-700 capitalize flex items-center gap-1 font-medium">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-600" />
                    {currentUser.role}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              </button>

              {/* User Menu Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-52 rounded-3xl border border-slate-200 bg-white p-1.5 shadow-lg ring-1 ring-slate-200 animate-in fade-in slide-in-from-top-3 duration-200">
                  <div className="px-3 py-2 border-b border-slate-200/70 mb-1">
                    <p className="text-xs text-slate-500">Signed in as</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{currentUser.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors text-left"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('achievements');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors text-left"
                  >
                    My Achievements
                  </button>
                  <button
                    onClick={async () => {
                      setShowUserMenu(false);
                      if (supabase) {
                        await supabase.auth.signOut();
                        window.location.reload();
                      } else {
                        toast.show('To logout completely, please clear local credentials.', 'info');
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

        {showMobileMenu && (
          <div className="border-t border-slate-200 bg-white px-2 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              {mobileNavItems.map((tab) => {
                const Icon = getNavIcon(tab.id);
                const isActive = activeTab === tab.id;
                const showBadge = tab.id === 'notifications' ? unreadCount > 0 : tab.id === 'messages' ? unreadDmCount > 0 : false;
                const badgeValue = tab.id === 'notifications' ? unreadCount : unreadDmCount;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'notifications') {
                        setShowNotifications(prev => !prev);
                      } else {
                        setActiveTab(tab.id);
                      }
                      setShowMobileMenu(false);
                    }}
                    className={`flex min-h-11 items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium ${isActive ? 'bg-cyan-50 text-cyan-700' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{tab.name}</span>
                    </span>
                    {showBadge && (
                      <span className="rounded-full bg-cyan-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                        {badgeValue > 9 ? '9+' : badgeValue}
                      </span>
                    )}
                  </button>
                );
              })}
              {(currentUser.role === 'organizer' || currentUser.role === 'admin') && (
                <button
                  onClick={() => { setActiveTab('organizer'); setShowMobileMenu(false); }}
                  className={`min-h-11 rounded-lg px-3 py-2 text-left text-sm font-semibold ${activeTab === 'organizer' ? 'bg-cyan-600 text-white' : 'text-cyan-700'}`}
                >
                  Organizer Hub
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
        {navItems.slice(0, 5).map((tab) => {
          const Icon = getNavIcon(tab.id);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold transition ${isActive ? 'bg-cyan-50 text-cyan-700 shadow-sm' : 'text-gray-500 hover:text-gray-950 hover:bg-gray-50'}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] tracking-wide">{tab.name}</span>
              {tab.id === 'messages' && unreadDmCount > 0 && (
                <span className="absolute right-2 top-1 rounded-full bg-cyan-600 px-1 text-[9px] font-bold text-white">
                  {unreadDmCount > 9 ? '9+' : unreadDmCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
    </>
  );
}
