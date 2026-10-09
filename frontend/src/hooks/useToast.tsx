import { createContext, useContext, useState, type ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);

  const addToast = (type: ToastType, message: string) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className={`pointer-events-auto flex items-center justify-between gap-3 p-4 pr-3 min-w-[280px] rounded-xl shadow-lg border animate-fade-slide-in ${
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-2.5">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-600" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
              <span className="text-sm font-semibold">{toast.message}</span>
            </div>
            <button onClick={() => removeToast(toast.id)} className={`p-1.5 rounded-full transition-colors ${
               toast.type === 'success' ? 'hover:bg-green-100 text-green-700' :
               toast.type === 'error' ? 'hover:bg-red-100 text-red-700' :
               toast.type === 'warning' ? 'hover:bg-yellow-100 text-yellow-700' :
               'hover:bg-blue-100 text-blue-700'
            }`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
