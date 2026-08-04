import type { InstallationItem } from '@/services/installationSyncService';

/**
 * Mapping các biến thể tên cột linh hoạt (Tolerance Column Parser)
 * Giúp hệ thống không bị crash nếu người dùng sửa tên cột nhẹ trên Google Sheet
 */
export const COLUMN_VARIATIONS: Record<keyof Omit<InstallationItem, 'rowId' | 'catName'>, string[]> = {
  projectCode: ['Mã dự án', 'Mã Dự Án', 'Mã DA', 'Project Code', 'MA DU AN'],
  projectName: ['Tên dự án', 'Tên Dự Án', 'Project Name', 'TEN DU AN'],
  posmTypeCode: ['Mã của loại POSM', 'Mã loại POSM', 'POSM Type Code', 'Mã loại POSM/Asset'],
  categoryCode: ['Mã Ngành hàng', 'Mã ngành hàng', 'Mã Ngành Hàng', 'Category Code'],
  brandCode: ['Mã nhãn hàng', 'Mã Nhãn Hàng', 'Brand Code'],
  brandName: ['Tên nhãn hàng', 'Tên Nhãn Hàng', 'Brand Name'],
  qtyPerAsset: ['Số lượng theo mỗi AssetID', 'Số lượng theo AssetID', 'Qty Per Asset', 'Số lượng'],
  region: ['Vùng', 'Region', 'Khu vực'],
  customer: ['Customer', 'Khách hàng', 'Tên Customer'],
  storeCode: ['Mã cửa hàng', 'Mã Cửa Hàng', 'Store Code', 'Mã CH'],
  storeName: ['Tên cửa hàng', 'Tên Cửa Hàng', 'Store Name', 'Tên CH'],
  plannedStartDate: ['Dự kiến thực hiện từ ngày', 'Dự kiến từ ngày', 'Planned Start Date'],
  plannedEndDate: ['Dự kiến thực hiện đến ngày', 'Dự kiến đến ngày', 'Planned End Date'],
  item: ['Hạng mục', 'Hạng Mục', 'Item'],
  size: ['Size', 'Kích thước'],
  supplierEmail: ['Supplier email', 'Email Supplier', 'Supplier Email'],
  supplierName: ['Supplier Name', 'Tên Supplier', 'Supplier'],
  agencyContact: ['Email người phụ trách từ Agency', 'Email Agency', 'Agency Contact'],
  technician: ['POSM QC Technician', 'QC Technician', 'Technician', 'Người phụ trách QC'],
  status: ['Status', 'Trạng thái', 'Trạng Thái'],
  actualTime: ['Actual Time', 'Thời gian thực tế', 'Thời gian thi công'],
  completionTime: ['Completion time', 'Completion Time', 'Thời gian hoàn thành'],
  resultSign: ['><', 'Kết quả', 'Result Sign'],
  warranty: ['Warranty - Uninstall', 'Warranty', 'Bảo hành'],
  note: ['Note', 'Ghi chú', 'Ghi Chú']
};

/**
 * Đọc giá trị cột linh hoạt với Tolerance Parser
 */
export const getRowValueFlexible = (
  rawRow: Record<string, any>, 
  field: keyof Omit<InstallationItem, 'rowId' | 'catName'>
): string => {
  const variations = COLUMN_VARIATIONS[field] || [];
  
  for (const varName of variations) {
    if (rawRow[varName] !== undefined && rawRow[varName] !== null) {
      return String(rawRow[varName]).trim();
    }
  }

  // Fallback: Tìm tương đối không phân biệt hoa thường
  const rawKeys = Object.keys(rawRow);
  for (const varName of variations) {
    const varLower = varName.toLowerCase();
    const matchedKey = rawKeys.find(k => k.trim().toLowerCase() === varLower);
    if (matchedKey && rawRow[matchedKey] !== undefined && rawRow[matchedKey] !== null) {
      return String(rawRow[matchedKey]).trim();
    }
  }

  return '';
};
