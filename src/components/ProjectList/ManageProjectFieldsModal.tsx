import React, { useState } from 'react';
import { X, Plus, Trash2, Check, XCircle } from 'lucide-react';
import { useGlobalProjectFields } from '../../hooks/useGlobalProjectFields';
import type { GlobalProjectField } from '../../hooks/useGlobalProjectFields';

interface ManageProjectFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageProjectFieldsModal({ isOpen, onClose }: ManageProjectFieldsModalProps) {
  const { fields, addField, deleteField } = useGlobalProjectFields();
  
  const [isAdding, setIsAdding] = useState(false);
  const [newField, setNewField] = useState<Partial<GlobalProjectField>>({
    field_name: '',
    field_key: '',
    field_type: 'text',
    is_required: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!newField.field_name || !newField.field_key) return;
    
    try {
      setIsSaving(true);
      await addField({
        field_name: newField.field_name,
        field_key: newField.field_key,
        field_type: newField.field_type as any,
        is_required: newField.is_required || false,
        options: newField.options
      });
      setIsAdding(false);
      setNewField({ field_name: '', field_key: '', field_type: 'text', is_required: false });
    } catch (err) {
      console.error(err);
      alert('Lỗi khi thêm trường mới!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa trường này? Tất cả dữ liệu của trường này sẽ không còn hiển thị.')) {
        try {
            setIsDeleting(true);
            await deleteField(id);
        } catch (err) {
            console.error(err);
            alert('Lỗi xóa trường!');
        } finally {
            setIsDeleting(false);
        }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Quản lý Trường Dữ Liệu Dự Án</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Cấu hình cột hiển thị trên bảng danh sách dự án.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div>
                  <h3 className="text-slate-800 dark:text-white font-medium">{field.field_name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-mono bg-slate-200 dark:bg-slate-900 px-2 py-0.5 rounded text-xs text-slate-600 dark:text-slate-300">{field.field_key}</span>
                    <span className="capitalize">{field.field_type}</span>
                    {field.is_required && <span className="text-amber-600 dark:text-amber-400 text-xs border border-amber-500/30 px-2 py-0.5 rounded">Bắt buộc</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDelete(field.id)}
                    disabled={isDeleting}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {isAdding ? (
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/30 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên hiển thị (Label)</label>
                    <input 
                      type="text" 
                      value={newField.field_name}
                      onChange={e => setNewField({...newField, field_name: e.target.value, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')})}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="VD: Ngân sách"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Khóa (Key)</label>
                    <input 
                      type="text" 
                      value={newField.field_key}
                      onChange={e => setNewField({...newField, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')})}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="VD: ngan_sach"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Loại dữ liệu</label>
                    <select 
                      value={newField.field_type}
                      onChange={e => setNewField({...newField, field_type: e.target.value as any})}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="text">Văn bản (Text)</option>
                      <option value="number">Số (Number)</option>
                      <option value="date">Ngày tháng (Date)</option>
                      <option value="boolean">Đúng/Sai (Checkbox)</option>
                      <option value="dropdown">Danh sách (Dropdown)</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newField.is_required}
                        onChange={e => setNewField({...newField, is_required: e.target.checked})}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Bắt buộc nhập</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving || !newField.field_name || !newField.field_key}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSaving ? 'Đang lưu...' : <><Check className="w-4 h-4" /> Lưu trường dữ liệu</>}
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAdding(true)}
                className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Thêm trường dữ liệu mới
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
