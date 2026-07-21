import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function NewRequestForm({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  // Google Form URL embedded format
  const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdd8uWzBk4L0qIrtIzyUfENQWdV9S_lSkgGEmQF1Zr7am_apg/viewform?embedded=true";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-none">
        <DialogHeader className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0 flex flex-row items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div>
            <DialogTitle className="text-xl">Tạo Request Mới (Google Form)</DialogTitle>
            <DialogDescription className="mt-1">
              Điền form bên dưới để tạo request. Dữ liệu sẽ được lưu thẳng vào Sheet Source.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 w-full bg-slate-50 dark:bg-slate-900">
          {open && (
            <iframe
              src={formUrl}
              width="100%"
              height="100%"
              frameBorder="0"
              marginHeight={0}
              marginWidth={0}
              title="Form tạo request POSM"
              className="w-full h-full"
            >
              Đang tải…
            </iframe>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
