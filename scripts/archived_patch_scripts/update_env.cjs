const fs = require('fs');
let content = fs.readFileSync('.env.local', 'utf8');
content += '\n# SUPABASE_SERVICE_ROLE_KEY="Thêm key quản trị vào đây để tiến trình ngầm không bị lỗi RLS"\n';
fs.writeFileSync('.env.local', content);
