function ExcelExtractorModal({ phaseType, projectGroup, downloadFileId, setDownloadFileId, onClose }: ExcelExtractorModalProps) {
    const queryClient = useQueryClient();

    const [selectedNtxxItem, setSelectedNtxxItem] = React.useState<StoreItem | null>(null);
    const [showNtxxModal, setShowNtxxModal] = React.useState(false);
    const [selectedSurveyItem, setSelectedSurveyItem] = React.useState<StoreItem | null>(null);
    const [showSurveyModal, setShowSurveyModal] = React.useState(false);
    const [selectedInstallItem, setSelectedInstallItem] = React.useState<StoreItem | null>(null);
    const [showInstallModal, setShowInstallModal] = React.useState(false);
    

    const surveyMutation = useMutation({
        mutationFn: async ({ id, surveyData, bulkProject }: { id?: string, surveyData: any, bulkProject?: string }) => {
            if (bulkProject) {
                const { error } = await supabase.from('project_store_items').update({ survey_data: surveyData }).eq('project_name', bulkProject);
                if (error) throw error;
            } else if (id) {
                const { error } = await supabase.from('project_store_items').update({ survey_data: surveyData }).eq('id', id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            setShowSurveyModal(false);
        }
    });

    const installMutation = useMutation({
        mutationFn: async ({ id, installData, bulkProject }: { id?: string, installData: any, bulkProject?: string }) => {
            if (bulkProject) {
                const { error } = await supabase.from('project_store_items').update({ installation_data: installData }).eq('project_name', bulkProject);
                if (error) throw error;
            } else if (id) {
                const { error } = await supabase.from('project_store_items').update({ installation_data: installData }).eq('id', id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            setShowInstallModal(false);
        }
    });

    const ntxxMutation = useMutation({
        mutationFn: async ({ id, ntxxData, bulkProject }: { id?: string, ntxxData: any, bulkProject?: string }) => {
            if (bulkProject) {
                const { error } = await supabase.from('project_store_items').update({ ntxx_data: ntxxData }).eq('project_name', bulkProject);
                if (error) throw error;
            } else if (id) {
                const { error } = await supabase.from('project_store_items').update({ ntxx_data: ntxxData }).eq('id', id);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items'] });
            setShowNtxxModal(false);
            setSelectedNtxxItem(null);
        }
    });

    const [file, setFile] = React.useState<File | null>(null);
    

    const [headers, setHeaders] = React.useState<string[]>([]);
    const [excelRows, setExcelRows] = React.useState<any[][]>([]);
    const [downloading, setDownloading] = React.useState(!!downloadFileId);
    
    // New states for raw excel rows and header row index
    const [rawExcelRows, setRawExcelRows] = React.useState<any[][]>([]);
    const [headerRowIdx, setHeaderRowIdx] = React.useState<number>(0);
    const [showSettings, setShowSettings] = React.useState<boolean>(false);
    const [showAdvancedMapping, setShowAdvancedMapping] = React.useState<boolean>(false);

    // Fetch existing project decision to check expected date
    const { data: existingDecision } = useQuery({
        queryKey: ['project_decision', projectGroup.final_project, phaseType],
        queryFn: async () => {
            const { data } = await supabase
                .from('project_decisions')
                .select('*')
                .eq('final_project', projectGroup.final_project)
                .eq('phase_type', phaseType)
                .maybeSingle();
            return data || null;
        }
    });

    const [localExpectedDate, setLocalExpectedDate] = React.useState<string>('');
    const [isConfirmed, setIsConfirmed] = React.useState<boolean>(false);

    React.useEffect(() => {
        if (existingDecision?.checklist_data?.expected_date) {
            setLocalExpectedDate(existingDecision.checklist_data.expected_date);
        }
    }, [existingDecision]);

    const saveExpectedDateAndProceed = async () => {
        if (!localExpectedDate) return false;
        
        const currentChecklist = existingDecision?.checklist_data || {};
        const updatedChecklist = {
            ...currentChecklist,
            expected_date: localExpectedDate
        };

        const { error } = await supabase
            .from('project_decisions')
            .upsert({
                final_project: projectGroup.final_project,
                phase_type: phaseType,
                decision_status: existingDecision?.decision_status || null,
                checklist_data: updatedChecklist,
                notes: existingDecision?.notes || null,
                updated_by: 'Admin',
                updated_at: new Date().toISOString()
            }, { onConflict: 'final_project,phase_type' });

        if (error) {
            alert('Lỗi lưu Ngày dự kiến: ' + error.message);
            return false;
        }

        queryClient.invalidateQueries({ queryKey: ['project_decision', projectGroup.final_project, phaseType] });
        queryClient.invalidateQueries({ queryKey: ['project_decisions', projectGroup.final_project] });
        return true;
    };

    // Card inline editing states
    const [editingRowIdx, setEditingRowIdx] = React.useState<number | null>(null);
    const [editStoreCode, setEditStoreCode] = React.useState('');
    const [editStoreName, setEditStoreName] = React.useState('');
    const [editCategory, setEditCategory] = React.useState('');
    const [editSupplierName, setEditSupplierName] = React.useState('');
    const [editNotes, setEditNotes] = React.useState('');

    const [mapping, setMapping] = React.useState<Record<string, number>>({
        store_code: -1,
        store_name: -1,
        category: -1,
        supplier_name: -1,
        notes: -1
    });

    const [loading, setLoading] = React.useState(false);
    const [success, setSuccess] = React.useState(false);

    // Auto-close modal after successful sync
    React.useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [success, onClose]);
    const [activeDragCol, setActiveDragCol] = React.useState<string | null>(null);

    // Query currently imported store items in database
    const { data: storeItems } = useQuery<StoreItem[]>({
        queryKey: ['project_store_items', projectGroup.final_project],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('project_store_items')
                .select('*')
                .eq('final_project', projectGroup.final_project)
                .order('store_code', { ascending: true });
            
            // removed undefined error throw
            return data as StoreItem[] || [];
        }
    });

    // Import store item mutation
    const importStoreMutation = useMutation({
        mutationFn: async (payload: Partial<StoreItem>) => {
            const { error } = await supabase
                .from('project_store_items')
                .upsert([payload], { onConflict: 'final_project,store_code' });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', projectGroup.final_project] });
        }
    });

    // Delete store item mutation
    const deleteItemMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('project_store_items')
                .delete()
                .eq('id', id);
            // removed undefined error throw
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['project_store_items', projectGroup.final_project] });
        }
    });

    // Helper algorithm to scan the first 15 rows and auto-detect the best header row based on keywords
    const detectHeaderRow = (rows: any[][]): number => {
        let bestRowIdx = 0;
        let maxScore = -1;
        
        const limit = Math.min(rows.length, 15);
        for (let r = 0; r < limit; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            
            let score = 0;
            row.forEach(cell => {
                if (!cell) return;
                const str = String(cell).toLowerCase().trim();
                if (str === 'stt' || str === 'no.') score += 2;
                if (str.includes('store code') || str.includes('store_code') || str.includes('mã ch') || str.includes('mã cửa hàng') || str.includes('storeid') || str.includes('site id')) score += 5;
                if (str.includes('store name') || str.includes('store_name') || str.includes('tên ch') || str.includes('tên cửa hàng') || str.includes('tên siêu thị') || str.includes('siêu thị')) score += 4;
                if (str.includes('khách hàng') || str.includes('khach hang') || str.includes('area') || str.includes('khu vực')) score += 2;
                if (str.includes('hạng mục') || str.includes('posm') || str.includes('item') || str.includes('loại')) score += 3;
                if (str.includes('nhà thầu') || str.includes('supplier') || str.includes('vendor') || str.includes('đơn vị') || str.includes('thầu')) score += 3;
                if (str.includes('thi công') || str.includes('ngày') || str.includes('lịch') || str.includes('tiến độ')) score += 2;
            });
            
            if (score > maxScore) {
                maxScore = score;
                bestRowIdx = r;
            }
        }
        
        return maxScore > 0 ? bestRowIdx : 0;
    };

    // Effect to download the file directly from Google Drive
    React.useEffect(() => {
        if (!downloadFileId) return;

        const downloadAndParse = async () => {
            setDownloading(true);
            try {
                const response = await fetch(`http://localhost:3001/api/attachments/${downloadFileId}/download`);
                if (!response.ok) {
                    throw new Error('Không tải được tệp từ máy chủ.');
                }
                const buffer = await response.arrayBuffer();
                const data = new Uint8Array(buffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                
                if (rawRows.length === 0) {
                    throw new Error('File Excel rỗng!');
                }

                setRawExcelRows(rawRows);
                
                // Auto-detect header row index
                const detectedIdx = detectHeaderRow(rawRows);
                setHeaderRowIdx(detectedIdx);
            } catch (err: any) {
                alert('Lỗi đọc file Excel từ Drive: ' + err.message);
                onClose();
            } finally {
                setDownloading(false);
            }
        };

        downloadAndParse();
    }, [downloadFileId]);

    // Handle local file uploads
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
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

    // Effect to auto-update headers and excel data rows when raw rows or header row index changes
    React.useEffect(() => {
        if (rawExcelRows.length === 0) return;

        const headersList = rawExcelRows[headerRowIdx]
            ? rawExcelRows[headerRowIdx].map((h, i) => String(h || `Cột ${i + 1}`).trim())
            : [];
        setHeaders(headersList);
        
        // Data starts from the row immediately after the header row
        setExcelRows(rawExcelRows.slice(headerRowIdx + 1));

        // Auto mapping algorithm
        const autoMap: Record<string, number> = {
            store_code: -1,
            store_name: -1,
            category: -1,
            supplier_name: -1,
            notes: -1
        };

        headersList.forEach((h, idx) => {
            if (!h) return;
            // Strip diacritics / accents from the header string
            const hl = String(h).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

            if (hl.includes('storecode') || hl.includes('store code') || hl.includes('store_code') || hl.includes('site id') || hl.includes('ma ch') || hl.includes('ma cua hang') || hl.includes('ma store') || hl.includes('essstorecode')) {
                autoMap.store_code = idx;
            } else if (hl.includes('ten sieu thi') || hl.includes('ten ch') || hl.includes('ten cua hang') || hl.includes('ten store') || hl.includes('store name') || hl.includes('store_name') || hl.includes('site name') || hl.includes('sieu thi')) {
                autoMap.store_name = idx;
            } else if (hl.includes('hang muc') || hl.includes('category') || hl.includes('posm') || hl.includes('item') || hl.includes('loai') || hl.includes('cat')) {
                autoMap.category = idx;
            } else if (hl.includes('nha thau') || hl.includes('supplier') || hl.includes('vendor') || hl.includes('don vi') || hl.includes('thau') || hl.includes('agency')) {
                autoMap.supplier_name = idx;
            } else if (hl.includes('ghi chu') || hl.includes('note') || hl.includes('y kien') || hl.includes('luu y')) {
                autoMap.notes = idx;
            }
        });

        // Fallbacks if not detected
        if (autoMap.store_code === -1) {
            // Try to find any column containing "store" or "code"
            const fallbackIdx = headersList.findIndex(h => {
                if (!h) return false;
                const hl = String(h).toLowerCase();
                return hl.includes('store') || hl.includes('code') || hl.includes('ch') || hl.includes('mã');
            });
            autoMap.store_code = fallbackIdx !== -1 ? fallbackIdx : 0;
        }

        setMapping(autoMap);
    }, [rawExcelRows, headerRowIdx]);

    const handleMapChange = (field: string, colIdx: number) => {
        setMapping(prev => ({ ...prev, [field]: colIdx }));
    };

    const startEditing = (
        originalIdx: number, 
        currentStoreCode: string, 
        currentStoreName: string, 
        currentCategory: string, 
        currentSupplierName: string, 
        currentNotes: string
    ) => {
        setEditingRowIdx(originalIdx);
        setEditStoreCode(currentStoreCode);
        setEditStoreName(currentStoreName);
        setEditCategory(currentCategory);
        setEditSupplierName(currentSupplierName);
        setEditNotes(currentNotes);
    };

    const saveRowEdit = (originalIdx: number) => {
        const updatedRows = [...excelRows];
        const row = [...(updatedRows[originalIdx] || [])];
        
        // Pad array if needed
        const maxIdx = Math.max(mapping.store_code, mapping.store_name, mapping.category, mapping.supplier_name, mapping.notes);
        while (row.length <= maxIdx) {
            row.push('');
        }

        if (mapping.store_code !== -1) row[mapping.store_code] = editStoreCode;
        if (mapping.store_name !== -1) row[mapping.store_name] = editStoreName;
        if (mapping.category !== -1) row[mapping.category] = editCategory;
        if (mapping.supplier_name !== -1) row[mapping.supplier_name] = editSupplierName;
        if (mapping.notes !== -1) row[mapping.notes] = editNotes;
        
        updatedRows[originalIdx] = row;
        setExcelRows(updatedRows);
        setEditingRowIdx(null);
    };

        const handleImportRowToStatus = async (rowIdx: number, targetStatus: string) => {
        const row = excelRows[rowIdx];
        if (!row) return;

        if (mapping.store_code === -1) {
            alert('Vui lòng ánh xạ cột "Mã Cửa Hàng (Store Code)" trước khi kéo nhập!');
            return;
        }

        const storeCode = row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
        if (!storeCode) {
            alert('Dòng dữ liệu này không có Mã Cửa Hàng hợp lệ.');
            return;
        }

        const storeName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : undefined;
        const category = mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : 'POSM';
        const supplierName = mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : undefined;
        const notes = mapping.notes !== -1 && row[mapping.notes] ? String(row[mapping.notes]).trim() : undefined;

        // Kiểm tra xem store có bị khóa không
        const existingStore = storeItems?.find((s: any) => s.store_code === storeCode);
        if (existingStore?.is_locked) {
            alert(`Cửa hàng ${storeCode} đang bị khóa tiến độ. Vui lòng mở khóa trên Dashboard trước khi nhập!`);
            return;
        }

        if (!localExpectedDate || !isConfirmed) {
            alert('Vui lòng điền Ngày dự kiến triển khai và tick Cam kết ở cột bên trái để mở khóa thao tác!');
            return;
        }

        const dateSaved = await saveExpectedDateAndProceed();
        if (!dateSaved) return;

        const statusField = phaseType === 'SURVEY' ? 'survey_status' : phaseType === 'INSTALLATION' ? 'installation_status' : 'acceptance_status';
        const notesField = phaseType === 'SURVEY' ? 'survey_notes' : phaseType === 'INSTALLATION' ? 'installation_notes' : 'acceptance_notes';

        const payload = {
            final_project: projectGroup.final_project,
            store_code: storeCode,
            store_name: storeName,
            category: category,
            supplier_name: supplierName,
            [statusField]: null, // Mặc định trạng thái là Trống khi mới trích xuất
            [notesField]: notes
        };

        importStoreMutation.mutate(payload);
    };

    const handleImportAll = async (targetStatus: string = 'Chờ làm') => {
        if (mapping.store_code === -1) {
            alert('Vui lòng ánh xạ cột "Mã Cửa Hàng" trước khi import!');
            return;
        }

        if (!localExpectedDate || !isConfirmed) {
            alert('Vui lòng điền Ngày dự kiến triển khai và tick Cam kết để mở khóa thao tác!');
            return;
        }

        setLoading(true);
        try {
            const dateSaved = await saveExpectedDateAndProceed();
            if (!dateSaved) {
                setLoading(false);
                return;
            }
            const payload = excelRows.map(row => {
                const storeCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                const storeName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : undefined;
                const category = mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : 'POSM';
                const supplierName = mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : undefined;
                const notes = mapping.notes !== -1 && row[mapping.notes] ? String(row[mapping.notes]).trim() : undefined;
                
                const statusField = phaseType === 'SURVEY' ? 'survey_status' : phaseType === 'INSTALLATION' ? 'installation_status' : 'acceptance_status';
                const notesField = phaseType === 'SURVEY' ? 'survey_notes' : phaseType === 'INSTALLATION' ? 'installation_notes' : 'acceptance_notes';
                
                return {
                    final_project: projectGroup.final_project,
                    store_code: storeCode,
                    store_name: storeName,
                    category: category,
                    supplier_name: supplierName,
                    [statusField]: null, // Mặc định là Trống để PM điền ngày mới mở khóa
                    [notesField]: notes
                };
            }).filter(item => item.store_code !== '');

            if (payload.length === 0) {
                throw new Error('Không tìm thấy dòng dữ liệu hợp lệ nào để import.');
            }

            const { error } = await supabase
                .from('project_store_items')
                .upsert(payload, { onConflict: 'final_project,store_code' });

            if (error) throw error;
            setSuccess(true);
            queryClient.invalidateQueries({ queryKey: ['project_store_items', projectGroup.final_project] });
        } catch (err: any) {
            alert('Lỗi import dữ liệu: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter excel rows that have not been imported yet (by store_code checking)
    const unimportedRows = excelRows.map((row, idx) => ({ row, originalIdx: idx })).filter(({ row }) => {
        if (mapping.store_code === -1) return true;
        const code = row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
        if (!code) return false;
        
        const existingStore = storeItems?.find((s: any) => s.store_code === code);
        return !existingStore;
    });

    const fields = [
        { key: 'store_code', label: 'Mã Cửa Hàng (Store Code) *', required: true },
        { key: 'store_name', label: 'Tên Cửa Hàng (Store Name)', required: false },
        { key: 'category', label: 'Hạng mục POSM (Category)', required: false },
        { key: 'supplier_name', label: 'Nhà thầu (Supplier)', required: false },
        { key: 'notes', label: 'Ghi chú (Notes)', required: false }
    ];


    const ntxxColumns = [
        { status: 'Cần hành động', label: 'Cần hành động', badgeColor: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
        { status: 'Chờ làm', label: 'Chờ làm', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30' },
        { status: 'Đang làm', label: 'Đang làm', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30' },
        { status: 'Quá hạn', label: 'Quá hạn', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30' },
        { status: 'Hoàn thành', label: 'Hoàn thành', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' },
        { status: 'Lỗi', label: 'Lỗi', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30' }
    ];

    const standardColumns = [
        { status: 'Chờ làm', label: 'Chờ làm', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
        { status: 'Đang làm', label: 'Đang làm', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900/30' },
        { status: 'Hoàn tất', label: 'Hoàn tất', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' },
        { status: 'Lỗi', label: 'Lỗi', badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30' }
    ];

    const kanbanColumns = phaseType === 'ACCEPTANCE' ? ntxxColumns : standardColumns;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 relative">
                {success && (
                    <div className="absolute inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
                        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center border border-emerald-250 dark:border-emerald-900/30 mb-4 animate-bounce">
                            <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-450" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">Đồng bộ thành công!</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Danh sách cửa hàng đã được lưu và cập nhật tiến độ.</p>
                    </div>
                )}
                
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/10">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        <div>
                            <h3 className="font-bold text-sm text-slate-850 dark:text-slate-100">
                                Kéo Thả Trích xuất Lịch trình Excel ({phaseType === 'SURVEY' ? 'Khảo Sát' : 'Lắp Đặt'})
                            </h3>
                            <p className="text-[10px] text-slate-450 font-semibold truncate max-w-lg">
                                Dự án: {projectGroup.final_project}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-455 hover:text-slate-655 dark:hover:text-slate-350 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content body split panel */}
                <div className="p-5 overflow-y-auto flex-1 flex flex-col md:flex-row gap-5 min-h-0 text-slate-700 dark:text-slate-300">
                    
                    {downloading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 animate-duration-1000" />
                            <p className="text-sm font-semibold text-slate-500">Đang tải và trích xuất tệp từ Google Drive...</p>
                        </div>
                    ) : (
                        <>
                            {/* File Upload Selector (Shown only if no downloadFileId provided) */}
                            {!downloadFileId && rawExcelRows.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-850 rounded-2xl bg-slate-50/20 max-w-md mx-auto w-full p-6 space-y-4">
                                    <FileSpreadsheet className="w-10 h-10 text-slate-350" />
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-slate-600">Chọn file Excel lịch trình</p>
                                        <p className="text-[10px] text-slate-400">Hỗ trợ tệp tin định dạng .xlsx, .xls</p>
                                    </div>
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls"
                                        onChange={handleFileChange}
                                        className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950/40 dark:file:text-emerald-400 cursor-pointer"
                                    />
                                </div>
                            )}

                            {(rawExcelRows.length > 0) && (
                                <>
                                    {/* Left Panel: Excel Cards source list (40% width) */}
                                    <div className="w-full md:w-[38%] flex flex-col gap-4 min-h-0 border-r border-slate-100 dark:border-slate-800/80 pr-4">
                                        
                                        {/* A. XÁC NHẬN NGÀY DỰ KIẾN & CAM KẾT */}
                                        <div className="bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 p-3 rounded-xl space-y-2.5 shadow-2xs">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                                <label className="text-[10px] font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                                                    Xác nhận Ngày Dự Kiến Triển Khai
                                                </label>
                                            </div>
                                            <input
                                                type="date"
                                                value={localExpectedDate}
                                                onChange={(e) => setLocalExpectedDate(e.target.value)}
                                                className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-indigo-500 outline-none text-slate-700 dark:text-slate-200"
                                            />
                                            <div className="flex items-start gap-2 pt-1.5 border-t border-indigo-150/40 dark:border-indigo-900/20">
                                                <input
                                                    type="checkbox"
                                                    id="confirm-commitment"
                                                    checked={isConfirmed}
                                                    onChange={(e) => setIsConfirmed(e.target.checked)}
                                                    className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <label htmlFor="confirm-commitment" className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal cursor-pointer select-none">
                                                    Tôi xác nhận ngày dự kiến này và đồng ý đồng bộ danh sách store.
                                                </label>
                                            </div>
                                        </div>

                                        {/* B. DANH SÁCH FILE TRONG MAIL THREAD ĐỂ ĐỐI CHIẾU */}
                                        {(() => {
                                            const currentActivity = projectGroup.activities.find(act => 
                                                act.activity_attachments?.some((att) => att.id === downloadFileId)
                                            );
                                            if (!currentActivity || !currentActivity.activity_attachments || currentActivity.activity_attachments.length === 0) return null;
                                            return (
                                                <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/60 dark:border-slate-800/40 p-3 rounded-xl space-y-2">
                                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
                                                        <Mail className="w-3.5 h-3.5 text-indigo-500" />
                                                        Tệp đính kèm trong Mail Thread:
                                                    </div>
                                                    <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                                                        {currentActivity.activity_attachments.map((att) => {
                                                            const isCurrent = att.id === downloadFileId;
                                                            const isExcel = att.file_name.toLowerCase().endsWith('.xlsx') || att.file_name.toLowerCase().endsWith('.xls');
                                                            return (
                                                                <div 
                                                                    key={att.id} 
                                                                    className={`flex items-center justify-between p-1.5 rounded text-[10px] border transition-all ${
                                                                        isCurrent 
                                                                            ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-bold' 
                                                                            : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/40 text-slate-600 dark:text-slate-400'
                                                                    }`}
                                                                >
                                                                    <span className="truncate max-w-[150px]" title={att.file_name}>{att.file_name}</span>
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <a href={`http://localhost:3001/api/attachments/${att.id}/download`} target="_blank" rel="noreferrer" className="text-[8px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 px-1 py-0.5 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-800 transition-all">Tải</a>
                                                                        {isExcel && !isCurrent && setDownloadFileId && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setDownloadFileId(att.id)}
                                                                                className="text-[8px] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 px-1.5 py-0.5 border border-emerald-100 dark:border-emerald-900/30 rounded bg-emerald-50/20 transition-all font-bold cursor-pointer"
                                                                                title="Trích xuất file này"
                                                                            >
                                                                                Xem
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* C. NÚT TOGGLE CẤU HÌNH ÁNH XẠ NÂNG CAO */}
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => setShowAdvancedMapping(!showAdvancedMapping)}
                                                className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800/60 px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer"
                                            >
                                                {showAdvancedMapping ? '⚙️ Ẩn cấu hình cột' : '⚙️ Hiện cấu hình cột'}
                                            </button>
                                        </div>

                                        {showAdvancedMapping && (
                                            <div className="bg-slate-50/40 dark:bg-slate-950/10 border border-slate-150 dark:border-slate-850 p-3 rounded-xl space-y-3">
                                                <div className="space-y-1.5">
                                                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                        1. Chọn dòng chứa tiêu đề cột (Header Row):
                                                    </label>
                                                    <select
                                                        value={headerRowIdx}
                                                        onChange={(e) => setHeaderRowIdx(Number(e.target.value))}
                                                        className="w-full text-xs p-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg outline-none font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                                                    >
                                                        {rawExcelRows.slice(0, 15).map((row, idx) => {
                                                            const rowPreview = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').slice(0, 4).join(' | ');
                                                            return (
                                                                <option key={idx} value={idx}>
                                                                    Dòng {idx + 1}: {rowPreview ? (rowPreview.length > 60 ? rowPreview.slice(0, 60) + '...' : rowPreview) : '(Trống)'}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                        2. Kéo thả Cột tiêu đề vào các ô bên dưới để ánh xạ:
                                                    </label>
                                                    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/50 dark:bg-slate-955/20 border border-slate-200/50 dark:border-slate-800/60 rounded-xl max-h-24 overflow-y-auto">
                                                        {headers.map((h, i) => {
                                                            const isMapped = Object.values(mapping).includes(i);
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.dataTransfer.setData('text/plain', `col:${i}`);
                                                                    }}
                                                                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all cursor-grab flex items-center gap-1 select-none ${
                                                                        isMapped 
                                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30 opacity-60' 
                                                                            : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:scale-105'
                                                                    }`}
                                                                    title="Kéo thả cột này"
                                                                >
                                                                    <Move className="w-2.5 h-2.5 shrink-0" />
                                                                    {h}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {fields.map(f => {
                                                            const mappedIdx = mapping[f.key];
                                                            const mappedName = mappedIdx !== -1 ? headers[mappedIdx] : null;
                                                            
                                                            return (
                                                                <div
                                                                    key={f.key}
                                                                    onDragOver={(e) => e.preventDefault()}
                                                                    onDrop={(e) => {
                                                                        const val = e.dataTransfer.getData('text/plain');
                                                                        if (val && val.startsWith('col:')) {
                                                                            const colIdx = Number(val.split(':')[1]);
                                                                            handleMapChange(f.key, colIdx);
                                                                        }
                                                                    }}
                                                                    className={`p-2 rounded-xl border border-dashed transition-all space-y-1 min-h-[50px] flex flex-col justify-center ${
                                                                        mappedName 
                                                                            ? 'bg-emerald-50/20 border-emerald-400/80 dark:bg-emerald-950/10 dark:border-emerald-900/40' 
                                                                            : 'bg-slate-50/50 border-slate-200 dark:bg-slate-950/20 dark:border-slate-850'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between gap-1.5">
                                                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{f.label}</span>
                                                                        {mappedName && (
                                                                            <button 
                                                                                onClick={() => handleMapChange(f.key, -1)}
                                                                                className="text-rose-500 hover:text-rose-700 text-[9px] font-bold cursor-pointer"
                                                                            >
                                                                                Gỡ
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    {mappedName ? (
                                                                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                                            <Check className="w-3 h-3" />
                                                                            {mappedName}
                                                                        </div>
                                                                    ) : (
                                                                        <select
                                                                            value={mappedIdx}
                                                                            onChange={(e) => handleMapChange(f.key, Number(e.target.value))}
                                                                            className="w-full text-[9px] p-0.5 bg-transparent border-0 outline-none text-slate-400 cursor-pointer"
                                                                        >
                                                                            <option value={-1}>-- Kéo hoặc chọn --</option>
                                                                            {headers.map((h, i) => (
                                                                                <option key={i} value={i}>{h}</option>
                                                                            ))}
                                                                        </select>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                                                                {/* List of excel row cards */}
                                        <div className="flex-1 flex flex-col min-h-0 space-y-2">
                                            <div className="flex items-center justify-between shrink-0">
                                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                    3. Thẻ cửa hàng từ Excel ({unimportedRows.length} thẻ chưa nhập):
                                                </label>
                                                {mapping.store_code !== -1 && unimportedRows.length > 0 && (
                                                    <button
                                                        type="button"
                                                        disabled={!localExpectedDate || !isConfirmed}
                                                        onClick={() => handleImportAll('Chờ làm')}
                                                        className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all border flex items-center gap-1 cursor-pointer ${
                                                            (!localExpectedDate || !isConfirmed)
                                                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                                                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400'
                                                        }`}
                                                        title="Nhập tất cả store này"
                                                    >
                                                        Nhập tất cả
                                                    </button>
                                                )}
                                            </div>
                                            
                                            <div style={{ height: '240px', minHeight: '240px' }} className="overflow-y-auto space-y-2 bg-slate-50/20 dark:bg-slate-950/10 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
                                                {unimportedRows.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center py-10 gap-2">
                                                        <Check className="w-6 h-6 text-emerald-500" />
                                                        <span className="text-[10px] text-slate-455 font-bold italic text-center">Đã nhập toàn bộ hoặc tệp Excel rỗng!</span>
                                                    </div>
                                                ) : (
                                                    unimportedRows.map(({ row, originalIdx }) => {
                                                        const storeCode = mapping.store_code !== -1 && row[mapping.store_code] ? String(row[mapping.store_code]).trim() : '';
                                                        const storeName = mapping.store_name !== -1 && row[mapping.store_name] ? String(row[mapping.store_name]).trim() : '';
                                                        const categoryName = mapping.category !== -1 && row[mapping.category] ? String(row[mapping.category]).trim() : '';
                                                        const supplierName = mapping.supplier_name !== -1 && row[mapping.supplier_name] ? String(row[mapping.supplier_name]).trim() : '';

                                                        return (
                                                            <div
                                                                key={originalIdx}
                                                                draggable={mapping.store_code !== -1}
                                                                onDragStart={(e) => {
                                                                    e.dataTransfer.setData('text/plain', `row:${originalIdx}`);
                                                                }}
                                                                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl shadow-2xs space-y-1.5 transition-all group select-none ${
                                                                    mapping.store_code !== -1 
                                                                        ? 'cursor-grab hover:border-indigo-400 dark:hover:border-indigo-900 hover:shadow-xs' 
                                                                        : 'opacity-70'
                                                                }`}
                                                                title={mapping.store_code !== -1 ? "Kéo thẻ này sang cột Kanban bên phải để import" : "Ánh xạ cột Store Code trước để kéo thẻ"}
                                                            >
                                                                <div className="flex items-center justify-between gap-1.5">
                                                                    <span className="text-[9px] font-bold text-slate-400">Dòng {originalIdx + headerRowIdx + 2}</span>
                                                                    <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.5 rounded uppercase">Excel</span>
                                                                </div>
                                                                
                                                                {mapping.store_code !== -1 ? (
                                                                    <div className="space-y-1 text-xs">
                                                                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                                                                            <Move className="w-3 h-3 text-slate-350 shrink-0 cursor-grab" />
                                                                            {storeCode || <span className="text-slate-400 italic font-normal">(Trống mã ch)</span>}
                                                                        </div>
                                                                        {storeName && <div className="text-[10px] text-slate-400 pl-4">{storeName}</div>}
                                                                        {(categoryName || supplierName) && (
                                                                            <div className="flex items-center gap-1.5 flex-wrap pl-4 pt-0.5">
                                                                                {categoryName && <span className="text-[8px] font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 px-1 py-0 rounded">{categoryName}</span>}
                                                                                {supplierName && <span className="text-[8px] font-bold text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800 px-1 py-0 rounded">{supplierName}</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[10px] text-slate-400 italic truncate pl-1">
                                                                        {row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').slice(0, 3).join(' | ')}
                                                                    </div>
                                                                )}
                                                                
                                                                {mapping.store_code !== -1 && (
                                                                    <div className="flex items-center gap-1.5 pt-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end border-t border-slate-50 dark:border-slate-850 mt-1">
                                                                        <button
                                                                            onClick={() => handleImportRowToStatus(originalIdx, 'Pending')}
                                                                            className="text-[8px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/30 transition-all cursor-pointer"
                                                                        >
                                                                            + Chờ làm
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleImportRowToStatus(originalIdx, 'Hoàn tất')}
                                                                            className="text-[8px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-955/40 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30 transition-all cursor-pointer"
                                                                        >
                                                                            + Xong
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Panel: Project Store Kanban Dropzones (62% width) */}
                                    <div className="flex-1 flex flex-col gap-4 min-h-0 relative">
                                        {(!localExpectedDate || !isConfirmed) && (
                                            <div className="absolute inset-0 z-10 bg-slate-50/60 dark:bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 rounded-2xl">
                                                <Lock className="w-8 h-8 text-indigo-500 mb-2 opacity-80" />
                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-350">Kéo Thả Kanban Bị Khóa</p>
                                                <p className="text-[10px] text-slate-500 max-w-xs mt-1">Vui lòng chọn Ngày dự kiến triển khai và tick Xác nhận cam kết ở cột bên trái để mở khóa.</p>
                                            </div>
                                        )}
                                        <div className="shrink-0">
                                            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                💡 Bảng Kanban Tiến độ Dự Án (Kéo thả thẻ Excel vào đây để lưu):
                                            </label>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                * Anh hãy kéo thả các thẻ cửa hàng từ bên trái vào 4 cột bên dưới để nhập danh sách và cập nhật trạng thái lập tức.
                                            </p>
                                        </div>

                                        {/* Kanban Columns Grid */}
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-h-0">
                                            {kanbanColumns.map(col => {

                                                const colItems = storeItems?.map(s => {
                                                    if (phaseType === 'ACCEPTANCE') {
                                                        const computed = computePhaseStatus(s.ntxx_data);
                                                        return { ...s, _display_status: computed.status, _display_detail: computed.detail };
                                                    }
                                                    return { ...s, _display_status: (s as any)[phaseType === 'SURVEY' ? 'survey_status' : phaseType === 'INSTALLATION' ? 'installation_status' : 'acceptance_status'] || 'Chờ làm' };
                                                }).filter(s => (s as any)._display_status === col.status) || [];
                                                const isHovered = activeDragCol === col.status;

                                                return (
                                                    <div
                                                        key={col.status}
                                                        className={`flex flex-col p-3 rounded-2xl border transition-all min-h-[300px] max-h-[500px] ${
                                                            isHovered 
                                                                ? 'bg-indigo-50/40 border-indigo-400 dark:bg-indigo-950/10 dark:border-indigo-900/50 scale-[1.02] shadow-md shadow-indigo-100/10' 
                                                                : 'bg-slate-50/40 border-slate-200/50 dark:bg-slate-950/10 dark:border-slate-850'
                                                        }`}
                                                    >
                                                        {/* Col Header */}
                                                        <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                                                            <span className={`text-[9px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-md border ${col.badgeColor}`}>
                                                                {col.label} ({colItems.length})
                                                            </span>
                                                        </div>

                                                        {/* Col Cards list */}
                                                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[400px]">
                                                            {colItems.length === 0 ? (
                                                                <div className="h-full flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-200/40 dark:border-slate-800/40 rounded-xl">
                                                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 italic">Trống</span>
                                                                </div>
                                                            ) : (
                                                                colItems.map(item => (
                                                                    <div
                                                                        key={item.id}
                                                                        onClick={() => {
                                                                            if (phaseType === 'ACCEPTANCE') {
                                                                                setSelectedNtxxItem(item);
                                                                                setShowNtxxModal(true);
                                                                            }
                                                                        }}
                                                                        className={`bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 p-2.5 rounded-xl shadow-2xs space-y-1 relative group hover:border-slate-350 dark:hover:border-slate-700 transition-all select-none ${phaseType === 'ACCEPTANCE' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
                                                                    >
                                                                        <button
                                                                            onClick={() => deleteItemMutation.mutate(item.id)}
                                                                            className="absolute top-2 right-2 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"
                                                                            title="Xóa cửa hàng này khỏi DB"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{item.store_code}</div>
                                                                        {item.store_name && <div className="text-[9px] text-slate-400 font-medium">{item.store_name}</div>}
                                                                        {item.category && <span className="inline-block text-[8px] font-bold text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 px-1 py-0 rounded">{item.category}</span>}
                                                                        {item.supplier_name && <div className="text-[8px] text-slate-500 font-medium">{item.supplier_name}</div>}
                                                                        {(item as any)._display_detail && <div className="mt-1 text-[8px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 p-0.5 rounded px-1 w-fit">{(item as any)._display_detail}</div>}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>


                {/* NTXX Action Modal */}
                {showNtxxModal && selectedNtxxItem && (
                    <PhaseActionModal 
                        item={selectedNtxxItem} 
                        phaseName="Nghiệm Thu Xưởng (NTXX)"
                        rawData={selectedNtxxItem.ntxx_data}
                        onClose={() => { setShowNtxxModal(false); setSelectedNtxxItem(null); }}
                        onSave={async (newData: any) => {
                            await ntxxMutation.mutateAsync({ id: selectedNtxxItem.id, ntxxData: newData });
                        }}
                        onBulkSave={async (newData: any) => {
                            await ntxxMutation.mutateAsync({ ntxxData: newData, bulkProject: projectGroup.final_project });
                        }}
                    />
                )}

                {/* Footer Controls */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-950/20 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer transition-colors"
                    >
                        Đóng
                    </button>
                </div>

            </div>
        </div>
    );
}

// ==========================================
// THẺ CHI TIẾT EMAIL (ActivityDetailCard)
// ==========================================
function ActivityDetailCard({ 
    activity, 
    projectGroup, 
    onExtractExcel 
}: { 
    activity: ActivityRow; 
    projectGroup: ProjectGroup; 
    onExtractExcel?: (fileId: string, phaseType: 'SURVEY' | 'INSTALLATION' | 'ACCEPTANCE', group: ProjectGroup) => void 
}) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs shadow-sm space-y-2 relative group hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-colors">
            {/* Header: mail title and time */}
            <div className="flex justify-between items-start gap-2">
                <a 
                    href={`https://mail.google.com/mail/u/0/#all/${activity.thread_id}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline line-clamp-2" 
                    title="Mở Email trên Gmail"
                >
                    {activity.title_mail}
                </a>
                <div className="text-[10px] text-slate-400 shrink-0">
                    {new Date(activity.created_at).toLocaleDateString('en-GB')}
                </div>
            </div>
            
            {/* Attachments */}
            {activity.activity_attachments && activity.activity_attachments.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Đính kèm:</div>
                    <div className="flex flex-wrap gap-2">
                        {activity.activity_attachments.map((att: any) => {
                            const isExcel = att.file_name.toLowerCase().endsWith('.xlsx') || att.file_name.toLowerCase().endsWith('.xls');
                            return (
                                <div key={att.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 rounded border border-slate-150 dark:border-slate-850 max-w-full">
                                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <a href={`http://localhost:3001/api/attachments/${att.id}/download`} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline truncate" title={att.file_name}>
                                        {att.file_name}
                                    </a>
                                    {isExcel && onExtractExcel && (
                                        <button 
                                            type="button"
                                            onClick={() => onExtractExcel(att.id, activity.phase_type as any, projectGroup)}
                                            className="ml-auto flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50 px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer"
                                            title="Trích xuất dữ liệu cửa hàng"
                                        >
                                            <FileSpreadsheet className="w-3 h-3" /> Trích xuất
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================

