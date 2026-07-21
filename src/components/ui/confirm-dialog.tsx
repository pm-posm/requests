import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  isDestructive = false
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="bg-card border border-border shadow-xl rounded-xl w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex gap-4 items-start">
            <div className={`p-2 rounded-full shrink-0 ${isDestructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
              <AlertCircle className="w-6 h-6" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground mb-2">
                {title}
              </h3>
              <div className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-secondary/50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm ${
              isDestructive 
                ? 'bg-destructive hover:bg-destructive/90' 
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
