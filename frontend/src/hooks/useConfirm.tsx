import { createContext, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => void;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [modalOptions, setModalOptions] = useState<ConfirmOptions | null>(null);

  const confirm = (options: ConfirmOptions) => {
    setModalOptions(options);
  };

  const handleConfirm = () => {
    if (modalOptions) modalOptions.onConfirm();
    setModalOptions(null);
  };

  const handleCancel = () => {
    setModalOptions(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {modalOptions && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-slide-in">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-red-50/30">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-gray-900">{modalOptions.title}</h3>
              </div>
              <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 leading-relaxed">{modalOptions.message}</p>
            </div>
            <div className="p-4 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
              <button onClick={handleCancel} className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 bg-white border border-gray-200 rounded-xl transition-colors">
                {modalOptions.cancelText || 'Cancel'}
              </button>
              <button onClick={handleConfirm} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors">
                {modalOptions.confirmText || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
  return context;
}
