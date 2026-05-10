import { useState, useEffect, useContext } from 'react';
import { X, Search, CheckCircle2, Loader2, UserMinus } from 'lucide-react';
import apiClient from '../../api/client';
import { AuthContext } from '../../context/AuthContext';

export default function ManageProjectMembersModal({ project, onClose }) {
  const { user: currentUser } = useContext(AuthContext);
  
  // States for our two lists
  const [currentMembers, setCurrentMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // We abstract the fetch logic into a callable function so we can refresh the modal 
  // after adding or removing someone without closing it.
  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, membersRes] = await Promise.all([
        apiClient.get('/auth/users'),
        apiClient.get(`/projects/${project.id}/members`)
      ]);

      const members = membersRes.data.members || [];
      setCurrentMembers(members);

      // Map string usernames to filter out people who are already members
      const memberUserNames = new Set(members.map(m => m.user_id)); 
      
      // Also filter out the project owner from the "add" list (they inherently have access)
      const available = usersRes.data.filter(u => !memberUserNames.has(u.user_id) && u.id !== project.owner_id);
      setAvailableUsers(available);
      
      // Clear selections on refresh
      setSelectedUserIds(new Set());
    } catch (err) {
      console.error(err);
      alert("Failed to load users. Ensure you have the correct permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [project.id]);

  const toggleUser = (userIdInt) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userIdInt)) {
      newSet.delete(userIdInt);
    } else {
      newSet.add(userIdInt);
    }
    setSelectedUserIds(newSet);
  };

  // --- ADD MEMBERS LOGIC ---
  const handleAdd = async () => {
    if (selectedUserIds.size === 0) return;
    setSubmitting(true);
    try {
      const promises = Array.from(selectedUserIds).map(userIdInt =>
        apiClient.post(`/projects/${project.id}/members/${userIdInt}`)
      );
      await Promise.all(promises);
      
      setSuccessMessage(`${selectedUserIds.size} member(s) added successfully.`);
      await fetchData(); // Refresh the lists to move them to "Current Members"
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to add some members.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- REMOVE MEMBER LOGIC ---
  const handleRemove = async (memberIntId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;
    
    setSubmitting(true);
    try {
      // The backend DELETE endpoint expects the user's integer ID
      await apiClient.delete(`/projects/${project.id}/members/${memberIntId}`);
      
      setSuccessMessage(`${memberName} removed successfully.`);
      await fetchData(); // Refresh the lists
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to remove member.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAvailableUsers = availableUsers.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={!submitting ? onClose : undefined}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Manage Project Members</h2>
            <p className="text-xs text-gray-500 mt-0.5">{project.project_name}</p>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:bg-gray-100 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Temporary Success Banner */}
        {successMessage && (
          <div className="bg-green-50 text-green-700 px-5 py-3 text-sm font-medium flex items-center gap-2 border-b border-green-100 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            {successMessage}
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* LEFT COLUMN: Current Members */}
          <div className="flex-1 border-r border-gray-200 p-5 overflow-y-auto bg-slate-50 custom-scrollbar">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Current Members ({currentMembers.length})
            </h3>
            
            {loading ? (
               <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : currentMembers.length === 0 ? (
               <p className="text-sm text-gray-500 italic">No additional members added yet.</p>
            ) : (
              <div className="space-y-2">
                {currentMembers.map(member => (
                  <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {member.initials}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{member.user_id}</p>
                      </div>
                    </div>
                    
                    {/* Remove Button */}
                    <button 
                      onClick={() => handleRemove(member.user_id_int, member.full_name)}
                      disabled={submitting}
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                      title="Remove from project"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Add New Members */}
          <div className="flex-1 p-5 flex flex-col bg-white overflow-hidden">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 shrink-0">
              Add New Members
            </h3>
            
            <div className="relative mb-4 shrink-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search directory..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredAvailableUsers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No available users found.</p>
              ) : (
                filteredAvailableUsers.map(u => (
                  <label key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      checked={selectedUserIds.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                    />
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {u.initials}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.user_id}</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={handleAdd}
                disabled={selectedUserIds.size === 0 || submitting}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Processing...' : `Add Selected Users (${selectedUserIds.size})`}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}