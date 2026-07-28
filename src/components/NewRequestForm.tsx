import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { Wrench, Copy, CheckCircle2, X } from 'lucide-react';

export default function NewRequestForm({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const prefillRequestData = useDashboardStore((state) => state.prefillRequestData);
  const setPrefillRequestData = useDashboardStore((state) => state.setPrefillRequestData);
  const [copied, setCopied] = React.useState(false);

  // Default Google Form URL
  const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSdd8uWzBk4L0qIrtIzyUfENQWdV9S_lSkgGEmQF1Zr7am_apg/viewform?embedded=true";

  const handleClose = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setPrefillRequestData(null);
    }
  };

  const handleCopyPrefill = () => {
    if (!prefillRequestData) return;
    const textToCopy = `[REQUEST BẢO HÀNH THIẾT BỊ]
- Mã Tài Sản: ${prefillRequestData.assetCode || 'N/A'}
- Thiết Bị: ${prefillRequestData.itemName || 'N/A'}
- Cửa Hàng: ${prefillRequestData.storeName || prefillRequestData.storeCode || 'N/A'}
- Vendor: ${prefillRequestData.vendorName || 'N/A'} (Hotline: ${prefillRequestData.vendorHotline || 'N/A'})
- Hạn Bảo Hành: ${prefillRequestData.expiryDate || 'N/A'}
- Mô tả sự cố: `;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-none">
        <DialogHeader className="p-4 border-b border-slate-100 dark:border-slate-800 shrink-0 flex flex-row items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Wrench className="w-5 h-5 text-sky-600" />
              Tạo Request Mới (Xử Lý Sự Cố / Bảo Hành)
            </DialogTitle>
            <DialogDescription className="mt-1">
              Điền form bên dưới để tạo request. Dữ liệu sẽ tự động được ghi nhận vào hệ thống.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* PRE-FILL BANNER WHEN TRIGGERED FROM WARRANTY TAB */}
        {prefillRequestData && (
          <div className="bg-sky-50 dark:bg-sky-950/60 border-b border-sky-200 dark:border-sky-800 p-3 px-4 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="font-mono px-2 py-0.5 bg-sky-600 text-white rounded font-bold text-[11px] shrink-0">
                {prefillRequestData.assetCode}
              </span>
              <div className="truncate">
                <span className="font-bold text-sky-950 dark:text-sky-100">{prefillRequestData.itemName}</span>
                <span className="text-sky-700 dark:text-sky-300 ml-2">
                  • {prefillRequestData.storeName} • Vendor: {prefillRequestData.vendorName}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyPrefill}
                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300 font-semibold rounded-lg hover:bg-sky-100 transition-colors shadow-sm"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép thông tin TS'}</span>
              </button>
              <button
                onClick={() => setPrefillRequestData(null)}
                className="p-1 text-sky-600 hover:text-sky-900 rounded"
                title="Bỏ tự động điền"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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
