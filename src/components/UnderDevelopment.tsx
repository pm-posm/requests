import React from 'react';
import { Construction, Lock, ShieldCheck, ClipboardCheck, BookUser, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UnderDevelopmentProps {
  title?: string;
  description?: string;
}

export function UnderDevelopment({ 
  title = "Tính năng đang phát triển", 
  description = "Tính năng này đang trong quá trình hoàn thiện và sẽ chính thức ra mắt trong tương lai." 
}: UnderDevelopmentProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-xl flex flex-col items-center">
        {/* Icon Container */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-5 ring-8 ring-amber-500/5">
          <Construction className="w-8 h-8 animate-bounce" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-3 border border-amber-500/20">
          <Lock className="w-3.5 h-3.5" />
          <span>Tạm khóa tính năng</span>
        </div>

        <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed mb-6">
          {description}
        </p>

        {/* Feature Highlights */}
        <div className="w-full bg-secondary/50 rounded-xl p-4 mb-6 border border-border text-left">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            3 Tính năng đang hoạt động chính thức:
          </span>
          <div className="space-y-2 text-xs">
            <button 
              onClick={() => navigate('/tracking/warranty')}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-background border border-border hover:border-sky-500/50 hover:bg-sky-500/5 transition-all text-slate-800 dark:text-slate-200 font-medium group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Bảo Hành & Đổi Trả</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-sky-500 transition-colors" />
            </button>

            <button 
              onClick={() => navigate('/tracking/installation')}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-background border border-border hover:border-sky-500/50 hover:bg-sky-500/5 transition-all text-slate-800 dark:text-slate-200 font-medium group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-sky-500" />
                <span>Theo Dõi Lắp Đặt</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-sky-500 transition-colors" />
            </button>

            <button 
              onClick={() => navigate('/contacts')}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-background border border-border hover:border-sky-500/50 hover:bg-sky-500/5 transition-all text-slate-800 dark:text-slate-200 font-medium group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <BookUser className="w-4 h-4 text-indigo-500" />
                <span>Danh Bạ Cửa Hàng</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-sky-500 transition-colors" />
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate('/tracking/warranty')}
          className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Quay lại trang Bảo Hành & Đổi Trả</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
