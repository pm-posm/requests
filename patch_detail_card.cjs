const fs = require('fs');
const path = 'src/components/Dashboard/ActivityDetailCard.tsx';
let content = fs.readFileSync(path, 'utf8');

const folderButtonStr = `
function FolderLinkButton({ finalProject, phaseType }: { finalProject: string, phaseType: string }) {
    const [loading, setLoading] = React.useState(false);

    const handleOpen = async () => {
        setLoading(true);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const response = await fetch(
                \`\${supabaseUrl}/functions/v1/project-folder-link?phase_type=\${phaseType}&final_project=\${encodeURIComponent(finalProject)}\`,
                { headers: { 'Authorization': \`Bearer \${supabaseAnonKey}\` } }
            );
            if (!response.ok) throw new Error('Không lấy được link thư mục.');
            const data = await response.json();
            if (data.folder_url) {
                window.open(data.folder_url, '_blank');
            } else {
                alert('Không tìm thấy thư mục Drive tương ứng với mã dự án: ' + finalProject);
            }
        } catch (err: any) {
            alert('Lỗi: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button type="button" onClick={handleOpen} disabled={loading} className="text-[11px] flex items-center gap-1 text-emerald-600 hover:text-emerald-700 hover:underline font-medium cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
            {loading ? 'Đang tìm...' : 'Mở Folder Drive'}
        </button>
    );
}
`;

// Insert the component before export function ActivityDetailCard
content = content.replace('export function ActivityDetailCard', folderButtonStr + '\nexport function ActivityDetailCard');

// Replace the old {activity.drive_url && ... } logic with unconditional <FolderLinkButton />
const oldLinkRegex = /\{activity\.drive_url && \(\s*<a href=\{activity\.drive_url\}[\s\S]*?<\/a>\s*\)\}/;
content = content.replace(oldLinkRegex, `<FolderLinkButton finalProject={projectGroup.final_project} phaseType={activity.phase_type || ''} />`);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched ActivityDetailCard.tsx');
