export interface StoreItem {
    id: string;
    store_code: string;
    store_name?: string;
    category?: string;
    supplier_name?: string;
    vis_tech?: string;
    region?: string;
    customer?: string;
    ka?: string;
    sr?: string;
    custom_files?: any[];
    project_name: string;
    final_project?: string;
    current_phase?: string;
    is_published?: boolean;
    is_locked?: boolean;
    // Legacy JSONB fields (being phased out - read only for migration)
    survey_data?: any;
    installation_data?: any;
    ntxx_data?: any;
    [key: string]: any;
}

export interface StorePhase {
    id?: string;
    store_item_id: string;
    phase: 'Brief' | 'Khảo sát' | 'NTXX' | 'Lắp đặt';
    expected_start?: string | null;
    expected_end?: string | null;
    actual_date?: string | null;
    result?: 'pass' | 'fail' | null;
    proof_links?: string[];
    notes?: string | null;
    vis_tech?: string | null;
    created_at?: string;
    updated_at?: string;
}

export type PhaseStatus = 'unscheduled' | 'scheduled' | 'in_progress' | 'late' | 'completed' | 'error';

export interface AttachmentRow {
    id: string;
    activity_id: string;
    file_name: string;
    drive_file_id: string;
    drive_url: string;
    md5?: string;
    created_at?: string;
    is_manual_upload?: boolean;
    uploaded_by?: string;
}

export interface ActivityRow {
    id: string;
    phase_type: 'BRIEF' | 'SURVEY' | 'INSTALLATION' | 'ACCEPTANCE' | 'NTXX' | string;
    title_mail?: string;
    key?: string;
    phase_id?: string;
    key_project?: string;
    project_name?: string;
    name_project?: string;
    final_project?: string;
    nguoi_gui?: string;
    thread_id?: string;
    created_at: string;
    updated_at?: string;
    drive_folder_id?: string;
    drive_url?: string;
    status?: string;
    activity_attachments?: AttachmentRow[];
    activity_subtype?: 'SCHEDULE' | 'REPORT' | string;
}

export interface ProjectGroup {
    final_project: string;
    key_project?: string;
    name_project?: string;
    activities: ActivityRow[];
    name?: string;
    projects?: any[];
    surveyCount?: number;
    installCount?: number;
    ntxxCount?: number;
    count?: number;
    stats?: {
        customer: string;
        storeCount: number;
        supplier: string;
        phase: string;
        posmType: string;
        status?: string;
    };
}

export interface ExcelExtractorModalProps {
    phaseType: 'SURVEY' | 'INSTALL' | 'NTXX';
    projectGroup: ProjectGroup;
    downloadFileId?: string | null;
    setDownloadFileId?: (id: string | null) => void;
    onClose: () => void;
}
