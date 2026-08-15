import { useState, useRef } from 'react';

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  id: 65,
  date: 110,
  store: 210,
  pic: 160,
  posm: 170,
  catBrand: 180,
  status: 170,
  progress: 170,
  plan: 160,
  supplier: 170,
  actions: 90
};

const STORAGE_COL_WIDTHS_KEY = 'posm_request_table_col_widths_v2';

/**
 * Custom hook quản lý resize cột bảng và persist vào localStorage
 * Tách ra từ RequestTableView.tsx (FIX U1 - code split)
 */
export function useColumnResize() {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COL_WIDTHS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_COLUMN_WIDTHS;
    } catch {
      return DEFAULT_COLUMN_WIDTHS;
    }
  });

  const resizingColRef = useRef<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = colKey;
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidths[colKey] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return;
      const deltaX = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(50, startWidthRef.current + deltaX);
      setColumnWidths(prev => {
        const updated = { ...prev, [resizingColRef.current!]: newWidth };
        try {
          localStorage.setItem(STORAGE_COL_WIDTHS_KEY, JSON.stringify(updated));
        } catch {
          // Ignore quota errors
        }
        return updated;
      });
    };

    const handleMouseUp = () => {
      resizingColRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const resetColumnWidths = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS);
    localStorage.removeItem(STORAGE_COL_WIDTHS_KEY);
  };

  return { columnWidths, handleResizeStart, resetColumnWidths };
}
