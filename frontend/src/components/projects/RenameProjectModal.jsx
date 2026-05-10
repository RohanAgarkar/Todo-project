import { useState } from 'react';
import { X, Edit2 } from 'lucide-react';
import apiClient from '../../api/client';

export default function RenameProjectModal({ project, onClose, onSuccess }) {
  const [name, setName] = useState(project.project_name);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || name === project.project_name) return onClose();

    setLoading(true);
    try {
      // Endpoint uses path parameters
      await apiClient.patch(`/projects/rename_project/${project.id}/${encodeURIComponent(name.trim())}`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to rename project.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-bold text-gray-900">Rename Project</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={loading} className="px-3 py-1.5 text-sm text-white bg-primary rounded-lg hover:bg-blue-700 disabled:opacity-70">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}