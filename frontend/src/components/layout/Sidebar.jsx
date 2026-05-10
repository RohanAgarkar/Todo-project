import { useState, useEffect, useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { WebSocketContext } from '../../context/WebSocketContext';
import apiClient from '../../api/client';
import { FolderKanban, Users, CheckSquare, Bell, LogOut, Loader2, AlertCircle, PlusCircle, WifiOff, Edit2, Trash2, UserPlus } from 'lucide-react';

// Import our new modals
import CreateProjectModal from '../projects/CreateProjectModal';
import RenameProjectModal from '../projects/RenameProjectModal';
import ManageProjectMembersModal from '../projects/ManageProjectMembersModal';

export default function Sidebar() {
  const { user, logout } = useContext(AuthContext);
  const { isConnected, isConnecting, lastMessage } = useContext(WebSocketContext);
  
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal & Context Menu States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renameProject, setRenameProject] = useState(null);
  const [manageMembersProject, setManageMembersProject] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get('/projects/');
      setProjects(response.data.projects || []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      setError('Could not load projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Listen for Live WebSocket Updates regarding Projects
  useEffect(() => {
    if (!lastMessage) return;
    const eventType = lastMessage.event;
    
    // Automatically refresh the sidebar if projects change!
    if (["project_created", "project_updated", "project_deleted"].includes(eventType)) {
      fetchProjects();
    }
  }, [lastMessage]);

  // Handle Global Click to close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Handle Right-Click on a project
  const handleContextMenu = (e, project) => {
    e.preventDefault(); // Stop default browser menu
    e.stopPropagation();
    
    // Only Project Owners (Admins/Managers who created it) can access this menu
    if (!project.is_owner) return; 

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      project
    });
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("Are you sure you want to completely delete this project? This action cannot be undone.")) return;
    try {
      await apiClient.delete(`/projects/${projectId}`);
      // Success will automatically trigger the WebSocket refresh
    } catch (err) {
      console.error(err);
      alert("Failed to delete project.");
    }
  };

  // Managers (moderator) and Admins can create projects
  const canCreateProject = ['admin', 'moderator'].includes(user?.role);

  const SidebarItem = ({ to, icon: Icon, label, onContextMenu }) => (
    <NavLink
      to={to}
      onContextMenu={onContextMenu}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
          isActive 
            ? 'bg-primary text-white' 
            : 'text-gray-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="font-medium text-sm truncate">{label}</span>
    </NavLink>
  );

  return (
    <>
      <aside className="w-64 bg-sidebar text-white flex flex-col h-screen overflow-hidden">
        <div className="p-6 flex items-center gap-3 border-b border-slate-700">
          <div className="flex gap-1">
            <div className="w-2 h-6 bg-primary rounded-full"></div>
            <div className="w-2 h-8 bg-primary rounded-full -mt-1"></div>
            <div className="w-2 h-6 bg-primary rounded-full"></div>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">LAN Kanban</h1>
            <span className="text-xs text-slate-400">Task Manager</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3 px-3">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Projects
              </h2>
              {canCreateProject && (
                <button onClick={() => setIsCreateModalOpen(true)} className="text-slate-400 hover:text-white transition-colors" title="Create New Project">
                  <PlusCircle className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {loading ? (
              <div className="flex items-center gap-2 px-3 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 px-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            ) : projects.length === 0 ? (
              <div className="px-3 py-6 text-center bg-slate-800/50 rounded-lg border border-slate-700 mx-2">
                <FolderKanban className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-300 font-medium">No Projects Yet</p>
                {canCreateProject && (
                  <button onClick={() => setIsCreateModalOpen(true)} className="mt-3 text-xs bg-primary hover:bg-blue-600 text-white px-3 py-1.5 rounded transition-colors w-full">
                    Create Project
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {projects.map((project) => (
                  <SidebarItem 
                    key={project.id} 
                    to={`/projects/${project.id}`} 
                    icon={FolderKanban} 
                    label={project.project_name}
                    onContextMenu={(e) => handleContextMenu(e, project)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">Workspace</h2>
            <div className="space-y-1">
              <SidebarItem to="/my-tasks" icon={CheckSquare} label="My Tasks" />
              <SidebarItem to="/notifications" icon={Bell} label="Notifications" />
              {user?.role === 'admin' && (
                <SidebarItem to="/manage-users" icon={Users} label="Manage Users" />
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 bg-slate-900 flex flex-col">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-center">
            {isConnected ? (
               <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full w-full justify-center border border-green-400/20">
                 <span className="relative flex h-2 w-2">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                 </span>
                 Connected to Server
               </div>
            ) : isConnecting ? (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full w-full justify-center border border-yellow-400/20">
                <Loader2 className="w-3 h-3 animate-spin" /> Reconnecting...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 px-3 py-1 rounded-full w-full justify-center border border-red-400/20">
                <WifiOff className="w-3 h-3" /> Offline
              </div>
            )}
          </div>
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {user?.initials || '??'}
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
                <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Global Right-Click Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden py-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} // Keep open if clicking inside
        >
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50 truncate">
            {contextMenu.project.project_name}
          </div>
          <button onClick={() => { setManageMembersProject(contextMenu.project); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
            <UserPlus className="w-4 h-4" /> Add Members
          </button>
          <button onClick={() => { setRenameProject(contextMenu.project); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
            <Edit2 className="w-4 h-4" /> Rename Project
          </button>
          <div className="border-t border-gray-100 my-1"></div>
          <button onClick={() => { handleDeleteProject(contextMenu.project.id); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
            <Trash2 className="w-4 h-4" /> Delete Project
          </button>
        </div>
      )}

      {/* Modals Mount */}
      {isCreateModalOpen && <CreateProjectModal onClose={() => setIsCreateModalOpen(false)} onSuccess={fetchProjects} />}
      {renameProject && <RenameProjectModal project={renameProject} onClose={() => setRenameProject(null)} onSuccess={fetchProjects} />}
      {manageMembersProject && <ManageProjectMembersModal project={manageMembersProject} onClose={() => setManageMembersProject(null)} />}
    </>
  );
}