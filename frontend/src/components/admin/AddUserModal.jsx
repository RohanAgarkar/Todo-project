import { useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import apiClient from '../../api/client';

export default function AddUserModal({ onClose, onUserAdded }) {
  // Form state holding the fields required by our AddUserRequest Pydantic schema
  const [formData, setFormData] = useState({
    user_id: '',     
    full_name: '',
    password: '',
    role: 'user'     // Defaults to 'user' (Team Member)
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Automatically generate 2-letter initials from the full name
  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length === 0 || parts[0] === '') return '??';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Handle input changes dynamically
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Submit the form to the backend
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent browser refresh
    setLoading(true);
    setError('');

    try {
      // We construct the exact payload expected by AddUserRequest schema
      const payload = {
        user_id: formData.user_id,
        password: formData.password,
        full_name: formData.full_name,
        initials: getInitials(formData.full_name),
        role: formData.role
      };

      // Hit the protected /auth/add_user endpoint
      await apiClient.post('/auth/add_user', payload);
      
      // If successful, notify the parent component to refresh the table and close modal
      onUserAdded();
      onClose();
    } catch (err) {
      console.error("Error adding user:", err);
      // Display the specific error message from FastAPI if it exists
      setError(err.response?.data?.detail || "Failed to add user. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // Modal Backdrop overlay
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      
      {/* Modal Container */}
      <div 
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" 
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
              <UserPlus className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Add New User</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-start gap-2 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Full Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              name="full_name"
              required
              value={formData.full_name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              placeholder="e.g. Jane Doe"
            />
          </div>

          {/* Username Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username (Login ID)</label>
            <input
              type="text"
              name="user_id"
              required
              value={formData.user_id}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              placeholder="e.g. jane.doe"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white"
            >
              {/* Added the moderator option to map perfectly to the FastAPI backend Enum */}
              <option value="user">Team Member (User)</option>
              <option value="moderator">Manager (Moderator)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-700 disabled:opacity-70 flex items-center justify-center min-w-[100px] transition-colors"
            >
              {loading ? 'Adding...' : 'Add User'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}