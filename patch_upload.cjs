const fs = require('fs');

const path = 'src/components/ExcelExtractor/ExcelExtractorModal.tsx';
let content = fs.readFileSync(path, 'utf8');

const uploadFunc = `
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        
        // -- UPLOAD LOGIC START --
        setDownloading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('final_project', projectGroup.final_project);
            
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            const res = await fetch(\`\${supabaseUrl}/functions/v1/upload-to-drive\`, {
                method: 'POST',
                headers: { 'Authorization': \`Bearer \${supabaseAnonKey}\` },
                body: formData
            });
            
            if (res.ok) {
                const uploadData = await res.json();
                
                // Insert into project_activities
                const { data: actData, error: actErr } = await supabase.from('project_activities').insert({
                    final_project: projectGroup.final_project,
                    key_project: projectGroup.key_project || '',
                    name_project: projectGroup.name_project || '',
                    phase_type: phaseType,
                    title_mail: '[Manual] File tải lên từ Dashboard',
                    sender: 'Admin',
                    date: new Date().toISOString()
                }).select().single();
                
                if (!actErr && actData) {
                    await supabase.from('activity_attachments').insert({
                        activity_id: actData.id,
                        file_name: uploadData.file_name || selectedFile.name,
                        drive_file_id: uploadData.drive_file_id,
                        drive_url: uploadData.drive_url,
                        is_manual_upload: true
                    });
                    
                    queryClient.invalidateQueries({ queryKey: ['project_activities_with_attachments_all'] });
                    queryClient.invalidateQueries({ queryKey: ['project_activities'] });
                    
                    if (setDownloadFileId) {
                        setDownloadFileId(uploadData.drive_file_id);
                    }
                }
            } else {
                console.warn('Lỗi upload file lên Google Drive, bạn cần cấu hình GOOGLE_PRIVATE_KEY trong Supabase Edge Functions');
            }
        } catch (e: any) {
            console.error('Lỗi khi upload file:', e.message);
        } finally {
            setDownloading(false);
        }
        // -- UPLOAD LOGIC END --

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                
                if (rawRows.length === 0) {
                    alert('File Excel rỗng!');
                    return;
                }

                setRawExcelRows(rawRows);
                const detectedIdx = detectHeaderRow(rawRows);
                setHeaderRowIdx(detectedIdx);
            } catch (err: any) {
                alert('Lỗi đọc file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    };
`;

const originalFuncRegex = /const handleFileChange = \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?reader\.readAsArrayBuffer\(selectedFile\);\n    \};/;

content = content.replace(originalFuncRegex, uploadFunc.trim());
fs.writeFileSync(path, content, 'utf8');
console.log('Patched ExcelExtractorModal.tsx with upload logic');
