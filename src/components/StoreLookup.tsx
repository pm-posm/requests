import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Search, MapPin, Store, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';

interface StoreData {
  "KA": string;
  "CUSTOMER": string;
  "STORE CODE": string;
  "STORE NAME": string;
  "REGION": string;
  "STORE LEVEL": string;
  "PROVINCE": string;
  "DISTRICT": string;
  "WARD": string;
  "ADDRESS": string;
  "MER NAME": string;
}

export default function StoreLookup({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [data, setData] = useState<StoreData[]>([]);
  const [filteredData, setFilteredData] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const CSV_URL = 'https://docs.google.com/spreadsheets/d/1Lct6U-pSOCpGUEGG_uDrjS5joQCJA4UvC66-QrkDKgE/export?format=csv&gid=1392312391';

  useEffect(() => {
    if (open && data.length === 0) {
      fetchData();
    }
  }, [open]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!debouncedSearchTerm.trim()) {
      setFilteredData(data.slice(0, 50)); // Show top 50 initially
      return;
    }

    const term = debouncedSearchTerm.toLowerCase();
    const filtered = data.filter(row => {
      return (
        (row["STORE CODE"]?.toLowerCase() || '').includes(term) ||
        (row["STORE NAME"]?.toLowerCase() || '').includes(term) ||
        (row["ADDRESS"]?.toLowerCase() || '').includes(term) ||
        (row["PROVINCE"]?.toLowerCase() || '').includes(term) ||
        (row["MER NAME"]?.toLowerCase() || '').includes(term)
      );
    });

    setFilteredData(filtered.slice(0, 100)); // Limit to 100 results for perf
  }, [debouncedSearchTerm, data]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        worker: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error('CSV Parsing errors:', results.errors);
          }
          // Lọc bỏ những dòng không có STORE CODE (dòng trống)
          const validData = (results.data as StoreData[]).filter(d => d["STORE CODE"] && d["STORE CODE"].trim() !== '');
          setData(validData);
          setFilteredData(validData.slice(0, 50));
          setIsLoading(false);
        },
        error: (err: any) => {
          console.error(err);
          setError('Không thể tải dữ liệu từ Google Sheet. Vui lòng kiểm tra kết nối.');
          setIsLoading(false);
        }
      });
    } catch (err) {
      console.error(err);
      setError('Đã xảy ra lỗi hệ thống.');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900">
        <DialogHeader className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Tra cứu Thông tin Cửa hàng
          </DialogTitle>
          <DialogDescription className="mt-1">
            Dữ liệu được lấy trực tiếp từ Sheet Contact (Phân vùng 03.26).
          </DialogDescription>

          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo Tên CH, Mã CH, Địa chỉ, MER..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-slate-500">Đang tải dữ liệu ({data.length} records)...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
              <p className="text-slate-600 dark:text-slate-400">{error}</p>
              <button onClick={fetchData} className="mt-4 text-primary hover:underline text-sm font-medium">Thử lại</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-500 mb-2">
                Hiển thị {filteredData.length} kết quả {searchTerm ? 'tìm kiếm' : 'đầu tiên'}
              </div>
              {filteredData.map((store, index) => (
                <div key={index} className="bg-white dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/30 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                          {store["STORE CODE"]}
                        </Badge>
                        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800">
                          {store["CUSTOMER"]}
                        </Badge>
                        <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 hidden md:inline-flex">
                          {store["REGION"]}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1.5 leading-snug">
                        {store["STORE NAME"]}
                      </h3>
                      
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                          <span className="leading-snug">{store["ADDRESS"]}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 w-full md:w-auto md:min-w-[12rem] bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800/50 flex flex-col gap-2">
                      <div>
                        <span className="block text-xs text-slate-500 mb-0.5">Người phụ trách (MER)</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{store["MER NAME"] || 'Chưa rõ'}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-slate-500 mb-0.5">Tỉnh/Thành</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{store["PROVINCE"]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredData.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500">Không tìm thấy cửa hàng nào khớp với "{searchTerm}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
