import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, XCircle } from 'lucide-react';
import { useCustomFields } from '../../../hooks/useCustomFields';
import type { CustomField } from '../../../hooks/useCustomFields';

interface ManageFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export function ManageFieldsModal({ isOpen, onClose, projectId }: ManageFieldsModalProps) {
  const { fields, createField, deleteField, isCreating, isDeleting } = useCustomFields(projectId);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newField, setNewField] = useState<Partial<CustomField>>({
    field_name: '',
    field_key: '',
    field_type: 'text',
    is_required: false,
    order_index: fields.length
  });

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!newField.field_name || !newField.field_key) return;
    
    try {
      await createField({
        project_id: projectId,
        field_name: newField.field_name!,
        field_key: newField.field_key!,
        field_type: newField.field_type as any,
        is_required: newField.is_required || false,
        order_index: fields.length,
        options: newField.options
      });
      setIsAdding(false);
      setNewField({ field_name: '', field_key: '', field_type: 'text', is_required: false, order_index: fields.length + 1 });
    } catch (err) {
      console.error(err);
      alert('Lỗi khi thêm trường mới!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-700/50">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Quản lý Trường Dữ Liệu</h2>
            <p className="text-sm text-slate-400 mt-1">Tạo và cấu hình các cột hiển thị trên bảng dự án.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div>
                  <h3 className="text-white font-medium">{field.field_name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                    <span className="font-mono bg-slate-900 px-2 py-0.5 rounded text-xs">{field.field_key}</span>
                    <span className="capitalize">{field.field_type}</span>
                    {field.is_required && <span className="text-amber-400 text-xs border border-amber-500/30 px-2 py-0.5 rounded">Bắt buộc</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => deleteField(field.id)}
                    disabled={isDeleting}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {isAdding ? (
              <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Tên hiển thị (Label)</label>
                    <input 
                      type="text" 
                      value={newField.field_name}
                      onChange={e => setNewField({...newField, field_name: e.target.value, field_key: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="VD: Ngày khảo sát"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Khóa (Key)</label>
                    <input 
                      type="text" 
                      value={newField.field_key}
                      onChange={e => setNewField({...newField, field_key: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="VD: ngay_khao_sat"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Loại dữ liệu</label>
                    <select 
                      value={newField.field_type}
                      onChange={e => setNewField({...newField, field_type: e.target.value as any})}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      <option value="text">Văn bản (Text)</option>
                      <option value="number">Số (Number)</option>
                      <option value="date">Ngày tháng (Date)</option>
                      <option value="boolean">Đúng/Sai (Checkbox)</option>
                    </select>
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newField.is_required}
                        onChange={e => setNewField({...newField, is_required: e.target.checked})}
                        className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500"
                      />
                      Bắt buộc nhập
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
                  >
                    Hủy
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isCreating || !newField.field_name || !newField.field_key}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> Lưu lại
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAdding(true)}
                className="w-full flex items-center justify-center gap-2 p-4 border border-dashed border-slate-700 rounded-lg text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all"
              >
                <Plus className="w-5 h-5" /> Thêm trường dữ liệu mới
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
