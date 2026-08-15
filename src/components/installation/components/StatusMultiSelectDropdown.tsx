import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { getStatusBadgeStyle } from '../utils/statusCalculators';

interface StatusMultiSelectDropdownProps {
  options: string[];
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
}

export const StatusMultiSelectDropdown: React.FC<StatusMultiSelectDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Chọn trạng thái (cho phép chọn nhiều)"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedList = React.useMemo(() => {
    if (!value || !value.trim()) return [];
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleOption = (st: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let current = [...selectedList];
    if (current.includes(st)) {
      current = current.filter(s => s !== st);
    } else {
      current.push(st);
    }
    onChange(current.join(', '));
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* TRIGGER BUTTON (Dropdown Header) */}
      <div
        onClick={() => setIsOpen(prev => !prev)}
        className={`
          w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-xl 
          flex items-center justify-between gap-2 cursor-pointer transition-all min-h-[42px]
          ${isOpen 
            ? 'border-sky-500 ring-2 ring-sky-500/10 bg-white dark:bg-slate-900' 
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }
        `}
      >
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {selectedList.length === 0 ? (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          ) : (
            selectedList.map((st, idx) => (
              <span 
                key={idx} 
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${getStatusBadgeStyle(st)}`}
              >
                <span>{st}</span>
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          {selectedList.length > 0 && (
            <span className="text-[10px] font-mono font-bold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded-full">
              {selectedList.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-sky-500' : ''}`} />
        </div>
      </div>

      {/* DROPDOWN MENU POPOVER */}
      {isOpen && (
        <div 
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 py-1 mb-1 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <span>Danh sách trạng thái (Tích chọn nhiều)</span>
            {selectedList.length > 0 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="text-rose-500 hover:underline font-semibold cursor-pointer"
              >
                Bỏ chọn tất cả
              </button>
            )}
          </div>

          <div className="space-y-1">
            {options.map(st => {
              const isChecked = selectedList.includes(st);
              return (
                <div
                  key={st}
                  onClick={(e) => handleToggleOption(st, e)}
                  className={`
                    flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all select-none
                    ${isChecked
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium'
                    }
                  `}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`
                      w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0
                      ${isChecked
                        ? 'bg-sky-600 border-sky-600 text-white'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950'
                      }
                    `}>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    <span className={`text-xs truncate px-1.5 py-0.5 rounded border ${getStatusBadgeStyle(st)}`}>
                      {st}
                    </span>
                  </div>

                  {isChecked && (
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold shrink-0">
                      ✓ Đã chọn
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
