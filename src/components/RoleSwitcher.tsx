import { Shield, Sparkles, User, Settings2 } from 'lucide-react';
import { UserRole } from '../types';

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  isSupabaseConfigured: boolean;
}

export default function RoleSwitcher({ currentRole, onRoleChange, isSupabaseConfigured }: RoleSwitcherProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-[#161920]/95 border border-emerald-500/30 rounded-2xl p-4 shadow-[0_10px_30px_rgba(16,185,129,0.15)] backdrop-blur-md max-w-sm w-[350px] text-left animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Settings2 className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Sandbox Role Hot-Swap</span>
        </div>
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
          {isSupabaseConfigured ? 'Real DB' : 'Simulated DB'}
        </span>
      </div>
      
      <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
        Hot-swap between roles to test different views and permissions (e.g. creating tournaments or submitting scores).
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { id: 'player', label: 'Player', icon: User, color: 'text-blue-400 hover:bg-blue-500/10 border-blue-500/20', activeBg: 'bg-blue-500 text-black border-blue-500' },
          { id: 'organizer', label: 'Organizer', icon: Sparkles, color: 'text-purple-400 hover:bg-purple-500/10 border-purple-500/20', activeBg: 'bg-purple-500 text-white border-purple-500' },
          { id: 'admin', label: 'Admin', icon: Shield, color: 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20', activeBg: 'bg-emerald-500 text-black border-emerald-500' }
        ].map((role) => {
          const Icon = role.icon;
          const isActive = currentRole === role.id;
          return (
            <button
              key={role.id}
              onClick={() => onRoleChange(role.id as UserRole)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                isActive
                  ? `${role.activeBg} font-bold scale-105 shadow-lg`
                  : `${role.color} bg-gray-900/40 text-gray-400`
              }`}
            >
              <Icon className="h-4 w-4 mb-1" />
              <span className="text-[10px] font-semibold">{role.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 pt-2 border-t border-gray-800/80 text-[9px] text-gray-500 text-center">
        {currentRole === 'player' && '👉 View brackets, join tournaments, edit profile.'}
        {currentRole === 'organizer' && '👉 Create tournaments, approve registrations, generate brackets.'}
        {currentRole === 'admin' && '👉 Master role. Supervise all matches and edit database tables.'}
      </div>
    </div>
  );
}
