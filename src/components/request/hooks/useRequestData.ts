import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  fetchRequestItems, 
  syncRequestRowToSheet, 
  DEFAULT_REQUEST_WEB_APP_URL,
  type RequestItem 
} from '@/services/requestSyncService';

export function useRequestData() {
  const [rawData, setRawData] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Web App Endpoint URL for 2-Way Sync
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem('POSM_REQUEST_WEB_APP_URL') || DEFAULT_REQUEST_WEB_APP_URL;
  });
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Selected item & Edit Drawer State
  const [selectedItem, setSelectedItem] = useState<RequestItem | null>(null);
  const [isSyncingRow, setIsSyncingRow] = useState(false);
  const [editForm, setEditForm] = useState<Partial<RequestItem>>({});

  // Sync Timestamp & Baseline Row Tracking
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    return localStorage.getItem('POSM_REQUEST_LAST_SYNC_TIME') || 'Chưa cập nhật';
  });
  const [baselineMaxRowId, setBaselineMaxRowId] = useState<number>(() => {
    return Number(localStorage.getItem('POSM_REQUEST_BASELINE_MAX_ROW_ID') || 0);
  });

  // Auto-refresh Timer State (300s = 5m)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(300);

  const loadData = async (isSilent: boolean = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRequestItems();

      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' • ' + new Date().toLocaleDateString('vi-VN');
      setLastSyncedAt(nowStr);
      localStorage.setItem('POSM_REQUEST_LAST_SYNC_TIME', nowStr);

      const maxId = data.reduce((max, d) => d.rowId > max ? d.rowId : max, 0);
      let storedBaselineMaxId = Number(localStorage.getItem('POSM_REQUEST_BASELINE_MAX_ROW_ID') || 0);

      if (storedBaselineMaxId === 0 && maxId > 0) {
        storedBaselineMaxId = maxId;
        localStorage.setItem('POSM_REQUEST_BASELINE_MAX_ROW_ID', String(storedBaselineMaxId));
      }

      setBaselineMaxRowId(storedBaselineMaxId);
      setRawData(data);
      setIsLoading(false);
      setIsRefreshing(false);
      setCountdownSeconds(300);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu Request Sheet:', err);
      if (!isSilent) {
        setError('Không thể lấy dữ liệu từ Google Sheet. Vui lòng kiểm tra kết nối mạng.');
      }
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const acknowledgeNewSync = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const maxId = rawData.reduce((max, d) => d.rowId > max ? d.rowId : max, 0);
    setBaselineMaxRowId(maxId);
    localStorage.setItem('POSM_REQUEST_BASELINE_MAX_ROW_ID', String(maxId));
    toast.success('✓ Đã xác nhận dữ liệu mới!');
  };

  useEffect(() => {
    loadData();
  }, []);

  // Auto Refresh Countdown Timer - Pause auto-refresh if Drawer is currently open to prevent data corruption
  useEffect(() => {
    if (!autoRefreshEnabled || Boolean(selectedItem)) return;
    const interval = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          loadData(true);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, selectedItem]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(true);
  };

  // FIX D1: Ensure emailTitle is populated into editForm when Drawer opens
  const handleOpenEdit = (item: RequestItem) => {
    setSelectedItem(item);
    setEditForm({
      emailTitle: item.emailTitle || '',
      status: item.status || '',
      planOption: item.planOption || '',
      projectProgress: item.projectProgress || '',
      deadline: item.deadline || '',
      quickFixDate: item.quickFixDate || '',
      supplier: item.supplier || '',
      projectCode: item.projectCode || '',
      requestId: item.requestId || '',
      merNote: item.merNote || '',
      sentMailSr: item.sentMailSr || ''
    });
  };

  // FIX D4: Optimistic update with Rollback mechanism on failure
  const handleSaveAndSync = async () => {
    if (!selectedItem) return;
    setIsSyncingRow(true);

    const previousData = [...rawData];

    const updatedData: RequestItem = {
      ...selectedItem,
      ...editForm
    };

    // Optimistic UI update
    setRawData(prev => prev.map(d => d.rowId === selectedItem.rowId ? updatedData : d));

    const result = await syncRequestRowToSheet(webAppUrl, {
      rowId: selectedItem.rowId,
      ...editForm
    });

    setIsSyncingRow(false);

    if (result.success) {
      toast.success(result.message);
      setSelectedItem(null);
    } else {
      // Rollback to previous data state on error
      setRawData(previousData);
      toast.error(result.message);
    }
  };

  const handleSaveConfig = (newUrl: string) => {
    setWebAppUrl(newUrl);
    localStorage.setItem('POSM_REQUEST_WEB_APP_URL', newUrl);
    setShowConfigModal(false);
    toast.success('Đã lưu Google Apps Script Web App Endpoint!');
  };

  return {
    rawData,
    isLoading,
    error,
    isRefreshing,
    lastSyncedAt,
    baselineMaxRowId,
    webAppUrl,
    setWebAppUrl,
    showConfigModal,
    setShowConfigModal,
    selectedItem,
    setSelectedItem,
    isSyncingRow,
    editForm,
    setEditForm,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    countdownSeconds,
    handleRefresh,
    acknowledgeNewSync,
    handleOpenEdit,
    handleSaveAndSync,
    handleSaveConfig
  };
}
