import { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';
import AddUserModal from '../components/admin/AddUserModal';
// Added UserCog icon for the Moderator role
import { Search, Plus, Edit2, Trash2, Shield, User as UserIcon, UserCog, Loader2, AlertCircle } from 'lucide-react';

export default function ManageUsers() {
  const { user } = useContext(AuthContext);
  
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/auth/users');
      setUsers(response.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("Could not load the user directory. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (userIdToDelete, userName) => {
    if (!window.confirm(`Are you sure you want to completely remove ${userName}?`)) return;

    try {
      await apiClient.delete(`/auth/delete_user?user_id=${userIdToDelete}`);
      setUsers(users.filter(u => u.user_id !== userIdToDelete));
    } catch (err) {
      console.error("Failed to delete user:", err);
      alert(err.response?.data?.detail || "Failed to delete user.");
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="relative max-w-md w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-white"
          />
        </div>
        
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shrink-0 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-sm">Loading user directory...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-gray-500 text-sm">
                      No users found matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((member) => (
                    <tr key={member.user_id} className="hover:bg-slate-50 transition-colors group">
                      
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                            {member.initials}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{member.full_name}</p>
                            <p className="text-xs text-gray-500">{member.user_id}</p>
                          </div>
                        </div>
                      </td>

                      {/* FIXED: Role Column now dynamically checks for all 3 roles */}
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-1.5">
                          {member.role === 'admin' ? (
                            <Shield className="w-4 h-4 text-purple-600" />
                          ) : member.role === 'moderator' ? (
                            <UserCog className="w-4 h-4 text-orange-600" />
                          ) : (
                            <UserIcon className="w-4 h-4 text-blue-600" />
                          )}
                          <span className="text-sm text-gray-700 capitalize">
                            {member.role === 'admin' ? 'Admin' : member.role === 'moderator' ? 'Manager' : 'Team Member'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-6">
                        <div className="flex items-center gap-1.5">
                          {member.user_id === user.user_id ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-sm text-gray-600">Online</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-gray-300 border border-gray-400"></div>
                              <span className="text-sm text-gray-500">Offline</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit User (Not Implemented)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          
                          {member.user_id !== user.user_id && (
                            <button 
                              onClick={() => handleDeleteUser(member.user_id, member.full_name)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-sm text-gray-500">
          Total {filteredUsers.length} users
        </div>
      </div>

      {isAddModalOpen && (
        <AddUserModal 
          onClose={() => setIsAddModalOpen(false)} 
          onUserAdded={fetchUsers} 
        />
      )}
    </div>
  );
}