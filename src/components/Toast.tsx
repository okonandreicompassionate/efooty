import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

type ToastType = 'info' | 'success' | 'error';
type ToastItem = { id: string; text: string; type?: ToastType };

const ToastContext = createContext<{ show: (text: string, type?: ToastType) => void } | null>(null);
const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";
const TECHNICAL_ERROR_PATTERNS = [
  /supabase/i,
  /schema/i,
  /row-level security/i,
  /duplicate key/i,
  /violates/i,
  /foreign key/i,
  /syntax/i,
  /undefined/i,
  /null/i,
  /exception/i,
  /stack/i,
  /sql/i,
  /42501/i,
  /jwt/i,
  /networkerror/i
];

const safeToastText = (text: string, type: ToastType) => {
  if (type !== 'error') return text;
  const trimmed = text.trim();
  if (!trimmed || TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return DEFAULT_ERROR_MESSAGE;
  }
  return trimmed.length > 120 ? DEFAULT_ERROR_MESSAGE : trimmed;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [list, setList] = useState<ToastItem[]>([]);

  const show = useCallback((text: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setList((s) => [...s, { id, text: safeToastText(text, type), type }]);
    setTimeout(() => setList((s) => s.filter(t => t.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[9999] sm:right-5">
        <div className="flex flex-col gap-2">
          {list.map(item => (
            <div key={item.id} className={`max-w-xs rounded-xl border px-3 py-2 text-sm shadow-lg ${item.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : item.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-800'}`}>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback no-op to avoid crashing in non-provider environments
    return { show: (text: string) => { try { console.warn('[toast] no provider:', text); } catch {} } };
  }
  return ctx;
};

export default ToastProvider;
