import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  fetchInstallationItems, 
  syncInstallationRowToSheet, 
  DEFAULT_INSTALLATION_WEB_APP_URL,
  type InstallationItem 
} from '@/services/installationSyncService';
import { getLiveMasterContactMap, type MasterStoreContactInfo } from '@/services/sheetSyncService';

export function useInstallationData() {
  const [rawData, setRawData] = useState<InstallationItem[]>([]);
  const [contactMap, setContactMap] = useState<Map<string, MasterStoreContactInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Web App Endpoint URL for 2-Way Sync
  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem('POSM_INSTALLATION_WEB_APP_URL') || DEFAULT_INSTALLATION_WEB_APP_URL;
  });
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Edit Drawer State for 2-Way Sync
  const [selectedItem, setSelectedItem] = useState<InstallationItem | null>(null);
  const [isSyncingRow, setIsSyncingRow] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InstallationItem>>({});

  // Real-time Sync & Audit Tracking States
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    return localStorage.getItem('POSM_INSTALLATION_LAST_SYNC_TIME') || 'Chưa cập nhật';
  });
  const [baselineMaxRowId, setBaselineMaxRowId] = useState<number>(() => {
    return Number(localStorage.getItem('POSM_INSTALLATION_BASELINE_MAX_ROW_ID') || 0);
  });
  const [baselineProjectCount, setBaselineProjectCount] = useState<number>(() => {
    return Number(localStorage.getItem('POSM_INSTALLATION_BASELINE_PRJ_COUNT') || 0);
  });

  // Auto-refresh Timer State (5 minutes default)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(300);

  const loadData = async (isSilent: boolean = false) => {
    if (!isSilent) setIsLoading(true);
    setError(null);
    try {
      const [data, contacts] = await Promise.all([
        fetchInstallationItems(),
        getLiveMasterContactMap().catch(err => {
          console.warn('Could not fetch live contact map:', err);
          return new Map<string, MasterStoreContactInfo>();
        })
      ]);

      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' • ' + new Date().toLocaleDateString('vi-VN');
      setLastSyncedAt(nowStr);
      localStorage.setItem('POSM_INSTALLATION_LAST_SYNC_TIME', nowStr);

      const maxId = data.reduce((max, d) => d.rowId > max ? d.rowId : max, 0);
      const uniquePrjCount = new Set(data.map(d => d.projectCode || d.projectName)).size;

      let storedBaselineMaxId = Number(localStorage.getItem('POSM_INSTALLATION_BASELINE_MAX_ROW_ID') || 0);

      if (storedBaselineMaxId === 0 && maxId > 0) {
        storedBaselineMaxId = maxId;
        localStorage.setItem('POSM_INSTALLATION_BASELINE_MAX_ROW_ID', String(storedBaselineMaxId));
        localStorage.setItem('POSM_INSTALLATION_BASELINE_PRJ_COUNT', String(uniquePrjCount));
      }

      setBaselineMaxRowId(storedBaselineMaxId);
      setBaselineProjectCount(uniquePrjCount);

      setRawData(data);
      setContactMap(contacts);
      setIsLoading(false);
      setIsRefreshing(false);
      setCountdownSeconds(300); // Reset timer on successful fetch
    } catch (err: any) {
      console.error('Error fetching sheet data:', err);
      if (!isSilent) {
        setError('Không thể lấy dữ liệu từ Google Sheet. Vui lòng kiểm tra kết nối internet.');
      }
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const acknowledgeNewSync = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const maxId = rawData.reduce((max, d) => d.rowId > max ? d.rowId : max, 0);
    const uniquePrjCount = new Set(rawData.map(d => d.projectCode || d.projectName)).size;
    setBaselineMaxRowId(maxId);
    setBaselineProjectCount(uniquePrjCount);
    localStorage.setItem('POSM_INSTALLATION_BASELINE_MAX_ROW_ID', String(maxId));
    localStorage.setItem('POSM_INSTALLATION_BASELINE_PRJ_COUNT', String(uniquePrjCount));
    toast.success('✓ Đã xác nhận — chữ Mới đã được xóa thành công!');
  };

  useEffect(() => {
    loadData();
  }, []);

  // Background Auto-Refresh Effect (5 phút / lần)
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const timer = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          loadData(true); // Silent background fetch
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Open Edit Modal for a row
  const handleOpenEdit = (item: InstallationItem) => {
    setSelectedItem(item);
    setEditForm({
      status: item.status || 'New',
      plannedStartDate: item.plannedStartDate || '',
      plannedEndDate: item.plannedEndDate || '',
      actualTime: item.actualTime || '',
      completionTime: item.completionTime || '',
      technician: item.technician || '',
      warranty: item.warranty || '',
      note: item.note || ''
    });
  };

  // Handle Save & 2-Way Sync with OPTIMISTIC UPDATE + AUTOMATIC ROLLBACK
  const handleSaveAndSync = async () => {
    if (!selectedItem) return;

    const snapshotPreviousData = [...rawData];

    setIsSyncingRow(true);
    const updatedRow = {
      ...selectedItem,
      ...editForm
    };

    // 1. Optimistic Update local state immediately
    setRawData(prev => prev.map(row => row.rowId === selectedItem.rowId ? updatedRow as InstallationItem : row));

    // 2. Perform 2-Way Sync to Google Sheet
    const result = await syncInstallationRowToSheet(webAppUrl, updatedRow);

    setIsSyncingRow(false);

    if (result.success && result.confirmed) {
      setSelectedItem(null);
      toast.success(result.message, { duration: 5000 });
    } else if (result.success && !result.confirmed) {
      setSelectedItem(null);
      toast(result.message, {
        icon: '📤',
        duration: 7000,
        style: { background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' }
      });
    } else {
      // ❌ Sync Failed: AUTOMATIC ROLLBACK
      setRawData(snapshotPreviousData);
      toast.error(`❌ Thất bại: ${result.message}. Đã tự động hoàn tác dữ liệu!`, { duration: 8000 });
    }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('POSM_INSTALLATION_WEB_APP_URL', webAppUrl);
    setShowConfigModal(false);
    toast.success('Đã lưu cấu hình Web App Endpoint 2-Chiều!');
  };

  return {
    rawData,
    setRawData,
    contactMap,
    isLoading,
    error,
    isRefreshing,
    lastSyncedAt,
    baselineMaxRowId,
    baselineProjectCount,
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
    loadData,
    handleRefresh,
    acknowledgeNewSync,
    handleOpenEdit,
    handleSaveAndSync,
    handleSaveConfig
  };
}
