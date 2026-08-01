export interface WarrantyItem {
  id: string;
  rowId: string;              // Row_ID (vd: 15, 658)
  requestId: string;          // Request ID (vd: BH-15, BH-658)
  storeName: string;          // Store name (vd: Lotte Can Tho)
  storeCode: string;          // Store code (vd: STR-LOT-00472)
  srName: string;             // SR (Sales Rep Unilever)
  visTech: string;            // VIS-Tech (Quản lý POSM thuộc Unilever)
  posmType: string;           // POSM (vd: GE CATMAN, Smart GE, AW GE)
  category: string;           // CAT (vd: Oral, Hair, SCL, FSen)
  brand: string;              // BRAND (vd: P/S, Dove, Close Up, Lifebuoy)
  sentDate: string;           // Ngày gửi yêu cầu (dd/mm/yyyy)
  requestDeadline?: string;   // Deadline hoàn thành request gốc (Ánh xạ từ Cột T Mer View 2026)
  installationDate?: string;  // Ngày lắp đặt POSM
  projectCode?: string;       // Mã dự án (vd: 105351)
  supplier: string;           // Supplier (Nhà cung cấp / Thầu sản xuất POSM)
  mailTitle?: string;         // Title mail
  errorDetail: string;        // Chi tiết lỗi
  progress: 'Hoàn Thành' | 'Tiếp nhận' | 'Đang xử lý' | 'Not Started' | string; // Tiến độ
  expectedDate?: string;      // Ngày xử lý dự kiến
  completedDate?: string;     // Ngày hoàn thành thực tế
  proofImage?: string;        // Link ảnh nghiệm thu
  note?: string;              // Ghi chú
  precedingRequestId?: string;// Mã bảo hành lần trước (Cột V BaoHanh_Model)
}

export interface WarrantyStats {
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  notStartedItems: number;
}

export interface ProjectDefectStat {
  projectCode: string;
  supplier: string;
  count: number;
  percentage: number;
}

export interface ErrorCategoryStat {
  category: string;
  iconName: string;
  count: number;
  percentage: number;
}

export interface WarrantySlaMetrics {
  avgDaysToFail: number;        // Lắp đặt ➔ Lỗi (MTBF)
  avgDaysToSchedule: number;    // Gửi ➔ Hẹn dự kiến
  avgDaysToComplete: number;    // Gửi ➔ Hoàn thành
  earlyFailCount: number;       // < 30 ngày
  midFailCount: number;         // 1 - 3 tháng
  longFailCount: number;        // > 3 tháng
  unrecordedInstallCount: number; // Chưa ghi nhận ngày lắp đặt
}
