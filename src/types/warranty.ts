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
  installationDate?: string;  // Ngày lắp đặt POSM
  projectCode?: string;       // Mã dự án (vd: 105351)
  supplier: string;           // Supplier (Nhà cung cấp / Thầu sản xuất POSM)
  mailTitle?: string;         // Title mail
  errorDetail: string;        // Chi tiết lỗi
  warrantyCoverage?: string;  // Trạng thái bảo hành (Trong phạm vi BH, ngoài phạm vi BH...)
  warrantyCost?: string;      // Chi phí bảo hành (Miễn phí, Có tính phí...)
  progress: 'Hoàn Thành' | 'Tiếp nhận' | 'Đang xử lý' | 'Not Started' | string; // Tiến độ
  expectedDate?: string;      // Ngày xử lý dự kiến
  completedDate?: string;     // Ngày hoàn thành thực tế
  proofImage?: string;        // Link ảnh nghiệm thu
  note?: string;              // Ghi chú
}

export interface WarrantyStats {
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  notStartedItems: number;
  freeCoverageItems: number;
}
