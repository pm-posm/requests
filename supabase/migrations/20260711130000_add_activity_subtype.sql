-- Thêm cột activity_subtype vào bảng project_activities
ALTER TABLE project_activities 
ADD COLUMN IF NOT EXISTS activity_subtype TEXT DEFAULT 'REPORT';

-- Cập nhật hồi tố (retroactive) cho các email cũ: nếu tiêu đề chứa từ khóa lịch/lich thì chuyển thành SCHEDULE
UPDATE project_activities
SET activity_subtype = 'SCHEDULE'
WHERE LOWER(title_mail) LIKE '%lịch%' OR LOWER(title_mail) LIKE '%lich%';
