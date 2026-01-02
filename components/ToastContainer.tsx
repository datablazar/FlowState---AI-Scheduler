
import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-bottom-5 fade-in duration-300 min-w-[300px]"
          style={{
            backgroundColor: toast.type === 'success' ? 'rgba(6, 78, 59, 0.9)' : toast.type === 'error' ? 'rgba(127, 29, 29, 0.9)' : 'rgba(39, 39, 42, 0.9)',
            borderColor: toast.type === 'success' ? 'rgba(52, 211, 153, 0.2)' : toast.type === 'error' ? 'rgba(248, 113, 113, 0.2)' : 'rgba(255, 255, 255, 0.1)',
          }}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-400" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
          
          <span className="flex-1 text-sm font-medium text-white">{toast.message}</span>
          
          <button onClick={() => onDismiss(toast.id)} className="text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
