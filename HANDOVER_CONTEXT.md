# 🚀 DỰ ÁN DASHBOARD QUẢN LÝ DỰ ÁN & BẢO HÀNH POSM (UNILEVER)
## 📌 HỒ SƠ CHUYỂN GIAO NGỮ CẢNH HỆ THỐNG (AGENT HANDOVER CONTEXT)

> **Mục đích**: Tài liệu này chứa đầy đủ toàn bộ kiến trúc, logic nghiệp vụ, trạng thái code hiện tại và hướng dẫn tiếp quản để bất kỳ AI Agent / Lập trình viên mới nào có thể đọc và tiếp tục phát triển ngay lập tức.

---

## 🛠️ 1. THÔNG TIN TỔNG QUAN VỀ DỰ ÁN

- **Tên dự án**: POSM Management & Warranty Tracking System (Dashboard POSM Unilever)
- **Đường dẫn thư mục dự án**: `C:\Users\thang\.gemini\antigravity\scratch\posm-dashboard`
- **Công nghệ (Tech Stack)**:
  - **Core**: React 18, TypeScript, Vite
  - **Styling**: Vanilla CSS + TailwindCSS (Full-bleed layout `max-w-[1920px]`, Dark/Light Mode)
  - **State / Data Fetching**: TanStack Query (React Query)
  - **Database & Sync**: Supabase + Google Sheets API Integration (`sheetSyncService.ts`)
  - **Notifications**: `react-hot-toast` (Vị trí mặc định: `bottom-right`)
  - **Icons**: Lucide React Icons

---

## 📂 2. CẤU TRÚC THƯ MỤC & FILE TRỌNG YẾU

```
posm-dashboard/
├── HANDOVER_CONTEXT.md              # File hồ sơ chuyển giao ngữ cảnh dự án cho AI Agent tiếp theo
├── src/
│   ├── App.tsx                      # Component gốc, cài đặt Router, QueryClient, Toaster (bottom-right)
│   ├── index.css                    # Design Tokens, Custom High-Contrast Scrollbar (8px/10px height)
│   ├── components/
│   │   ├── Dashboard.tsx            # Main layout wrapper, Full-bleed (max-w-[1920px]), Sidebar navigation
│   │   ├── Dashboard/
│   │   │   ├── DashboardOverview.tsx # Tổng quan chỉ số KPIs dự án
│   │   │   ├── MerRequestsTable.tsx  # Tab "Yêu Cầu POSM" - Quản lý, bộ lọc động (Năm 2026, Mer, PhuongAn, Status, TienDo)
│   │   │   ├── RequestTableRow.tsx   # Hiển thị từng dòng Request POSM, ô dropdown chuyển trạng thái
│   │   │   └── SyncControlBar.tsx    # Thanh Toolbar chính (Đã lược bỏ nút đổi view dạng Bảng/Kanban)
│   │   ├── ProjectList/
│   │   │   └── ProjectTable.tsx     # Bảng Tổng Hợp Dự Án - Tự động nhận diện Email giai đoạn mới
│   │   ├── TrackingWarranty.tsx     # Tab "Bảo Hành & Đổi Trả" (Analyst Charts & Data List Grid)
│   │   └── ModelTest.tsx            # Logic thử nghiệm Audit MailRead timestamp
│   ├── hooks/
│   │   └── useWorkflowEngine.ts     # Dynamic Workflow Engine kết nối Supabase table 'workflow_statuses'
│   └── services/
│       └── sheetSyncService.ts      # Đồng bộ 2 chiều dữ liệu với Google Sheet Source & Target
```

---

## 📊 3. NGHIỆP VỤ & NGUYÊN LÝ HOẠT ĐỘNG CỐT LÕI

### A. Dynamic Workflow Engine & Cấu Hình Trạng Thái (`MerRequestsTable.tsx` & `useWorkflowEngine.ts`)
- **Nguyên lý phân nhóm (`getRequestCategory`)**:
  - Dữ liệu Request có 2 trường: **Trạng Thái** (`r.status` - ví dụ: `Approved`) và **Tiến Độ** (`r.tien_do` - ví dụ: `Hoàn Thành`, `Cancelled`, `CSP - Gửi thiết kế`).
  - **Ưu tiên hàng đầu**: Hệ thống luôn kiểm tra Tiến Độ (`r.tien_do`) trước tiên theo cấu hình trong Modal "Dynamic Workflow".
  - Nếu `r.tien_do` là `Hoàn Thành`, `Cancelled`, hay `Rejected` ➔ Nhóm Trạng Thái (`TRẠNG THÁI NHÓM`) tự động hiển thị **`Hoàn thành (Done)`** màu xanh lá nổi bật, không bị đè bởi giá trị `Approved` của cột Trạng thái.

### B. Bộ Lọc Theo Năm (`filterYear` trong `MerRequestsTable.tsx`)
- **Mặc định khi mở tab**: Luôn mặc định là **`Năm: Năm 2026`**.
- **Logic trích xuất năm**: Chỉ lấy 4 chữ số năm từ ngày gửi Request thực tế (`date_of_rq`) hoặc hạn (`deadline`). Gỡ bỏ hoàn toàn `created_at` (ngày lưu vào Supabase) để tránh lệch dữ liệu năm 2025 sang 2026.

### C. Quản Lý Mail Giai Đoạn Mới (`ProjectTable.tsx`)
- Tự động so sánh thời điểm nhận Mail cào mới nhất (`latestActivityMs`) với mốc PM xác nhận (`processedAtMs`):
  - `⚡ Mail giai đoạn mới [Lắp đặt]`: Phát hiện mail mới sau khi đã hoàn thành khảo sát (màu tím nhấp nháy).
  - `⚡ Mail mới [Khảo sát]`: Mail khảo sát chưa xử lý (màu cam nhấp nháy).
  - `✓ Mail đã xử lý [Lắp đặt]`: Mail đã được PM bấm xác nhận.

### D. Tab Bảo Hành & Analyst Breakdown (`TrackingWarranty.tsx`)
- **Top Dự Án Phát Sinh Lỗi Nhiều Nhất (Analyst Card)**: Bóc tách danh sách TẤT CẢ các Supplier cùng thi công cho dự án đó và đánh số ca bảo hành cụ thể từng Supplier (ví dụ: Dự án `156822` hiển thị `Link4: 6 ca` | `Smart: 4 ca`).
- **Cột Supplier trong Data List**: Hiển thị tên Supplier sạch sẽ, đã ẩn dòng chữ phụ `PJ: <mã dự án>` trùng lặp.
- **Vị trí Popup Thông Báo**: Toaster xuất hiện ở góc dưới bên phải (`bottom-right`), không che khuất nút `X` đóng Modal ở góc trên.

---

## 🔗 4. CẤU HÌNH GOOGLE SHEETS & DATABASE

- **Source Sheet ID**: `1sbp9fgrkywkns0q-o1iiAIPo2dJp22uQ8w39L7U4jIU` (Tab: `Mer View 2026`)
- **Target Sheet ID**: `119LpiU1XheXgOxKWxw17E_u4vgRTBPhc-4FADDS8B1Q` (Tab: `BaoHanh_Model`)
- **Supabase Table**: `workflow_statuses` (quản lý phân nhóm 4 trạng thái: `to_do`, `in_progress`, `review`, `done`).

---

## ⚡ 5. LỆNH CHẠY & KIỂM TRA (COMMANDS)

- **Chạy môi trường Dev local**:
  ```bash
  npm run dev
  ```
  *(Truy cập tại http://localhost:5173)*

- **Kiểm tra biên dịch Production Build**:
  ```bash
  npm run build
  ```
  *(Hiện tại đã build 100% clean trong ~1.3s với 0 lỗi).*

---

## 📝 6. CÁC QUY TẮC PHÁT TRIỂN CẦN LƯU Ý CHO AGENT MỚI

1. **Tuyệt đối không khôi phục giao diện Kanban**: Người dùng đã yêu cầu xem dạng Bảng chuẩn duy nhất, không thêm lại toggle view dạng Bảng / Jira board.
2. **Bảo tồn Sticky Table Header & Scrollbar**: Table trong hệ thống luôn duy trì `max-h-[calc(100vh-220px)] overflow-auto custom-scrollbar` với sticky header `sticky top-0 z-20`.
3. **Giữ Toast Notification ở `bottom-right`**: Toaster trong `App.tsx` luôn duy trì `position="bottom-right"`.
4. **Logic SLA Badges**: Hiện tại hàm `getSlaOverdueBadge` trong `MerRequestsTable.tsx` đang trả về `null` (tắt tạm thời theo yêu cầu người dùng). Khi nào người dùng yêu cầu bật lại SLA mới bổ sung lại logic.
