import React from 'react';
import { FileText, FileSpreadsheet } from 'lucide-react';

export function ProjectActionSidebar({
    briefStatus,
    setBriefStatus,
    saveBriefMutation,
    allExcelFiles,
    downloadFileId,
    setDownloadFileId,
    setSelectedFile,
    setActiveTab
}: any) {
    return (
        <div className="w-[320px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/30 dark:bg-slate-950/20 shrink-0">
            {/* Brief Config */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-1.5"><FileText className="w-4 h-4 text-blue-500" /> Cấu hình Brief</h4>
                <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-slate-500">Hành động sản xuất:</label>
                    <select
                        value={briefStatus}
                        onChange={(e) => setBriefStatus(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="">-- Chọn hành động --</option>
                        <option value="Thêm mới không thu hồi">Thêm mới không thu hồi</option>
                        <option value="Thêm mới có thu hồi">Thêm mới có thu hồi</option>
                        <option value="Thu hồi hoàn toàn">Thu hồi hoàn toàn</option>
                        <option value="Sửa chữa">Sửa chữa</option>
                    </select>
                    <button 
                        onClick={() => saveBriefMutation.mutate(briefStatus)}
                        disabled={saveBriefMutation.isPending || !briefStatus}
                        className="w-full mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer"
                    >
                        {saveBriefMutation.isPending ? 'Đang lưu...' : 'Lưu Brief'}
                    </button>
                </div>
            </div>

            {/* Excel Files List */}
            <div className="p-4 flex-1 overflow-y-auto min-h-0">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-3 flex items-center gap-1.5"><FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Nguồn trích xuất Excel</h4>
                {allExcelFiles.length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center py-4 border border-dashed rounded-lg">Không tìm thấy file Excel nào trong các luồng mail.</div>
                ) : (
                    <div className="space-y-2">
                        {allExcelFiles.map((att: any) => (
                            <div key={att.id} className={`p-2.5 rounded-xl border transition-all ${downloadFileId === (att.drive_file_id || att.id) ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 shadow-sm' : 'bg-white border-slate-200 dark:bg-slate-900 hover:border-emerald-300'}`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${att.phase === 'SURVEY' ? 'bg-purple-100 text-purple-700' : att.phase === 'INSTALLATION' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{att.phase}</span>
                                </div>
                                <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 truncate mb-2" title={att.file_name}>{att.file_name}</p>
                                <button 
                                    onClick={() => {
                                        if(setDownloadFileId) setDownloadFileId(att.drive_file_id || att.id);
                                        setSelectedFile(att);
                                        setActiveTab('EXTRACT');
                                    }}
                                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-1.5 rounded transition-colors cursor-pointer"
                                >
                                    {downloadFileId === (att.drive_file_id || att.id) ? 'Đang chọn' : 'Trích xuất file này'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
