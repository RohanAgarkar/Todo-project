import { useState, useEffect, useContext } from 'react';
import { X, Calendar, MessageSquare, AlertCircle, Loader2, Send, Edit2, Trash2, Save, Plus } from 'lucide-react';
import apiClient from '../../api/client';
import { AuthContext } from '../../context/AuthContext';
import { WebSocketContext } from '../../context/WebSocketContext';
import { format } from 'date-fns';

export default function TaskDetailsModal({ taskId, onClose }) {
  const { user } = useContext(AuthContext);
  
  // NEW: Pull the lastMessage from our live WebSocket connection
  const { lastMessage } = useContext(WebSocketContext);
  
  // Data states
  const [taskData, setTaskData] = useState(null);
  const [comments, setComments] = useState([]);
  const [projectMembers, setProjectMembers] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    priority: '',
    due_date: ''
  });

  // 1. Fetch task details, comments, and project members on mount
  useEffect(() => {
    const fetchTaskDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const [taskRes, commentsRes] = await Promise.all([
          apiClient.get(`/tasks/${taskId}`),
          apiClient.get(`/tasks/${taskId}/comments`)
        ]);
        
        setTaskData(taskRes.data);
        setComments(commentsRes.data.comments || []);
        
        setEditForm({
          title: taskRes.data.task.title,
          description: taskRes.data.task.description || '',
          priority: taskRes.data.task.priority,
          due_date: taskRes.data.task.due_date ? taskRes.data.task.due_date.split('T')[0] : ''
        });

        const projId = taskRes.data.task.project_id;
        const membersRes = await apiClient.get(`/projects/${projId}/members`);
        setProjectMembers(membersRes.data.members || []);

      } catch (err) {
        console.error("Failed to fetch task details:", err);
        setError("Could not load task details.");
      } finally {
        setLoading(false);
      }
    };

    if (taskId) fetchTaskDetails();
  }, [taskId]);

  // 2. NEW: Listen for Live WebSocket Updates specifically for Comments
  useEffect(() => {
    if (!lastMessage) return;
    
    const eventType = lastMessage.event;
    const payload = lastMessage.data || lastMessage;

    if (eventType === "comment_added") {
      const incomingComment = payload.comment;
      
      // Ensure the comment belongs to the task we are currently viewing
      if (incomingComment && incomingComment.task_id === taskId) {
        setComments(prevComments => {
          // Check if we already have this comment to prevent duplicates 
          // (because the person who typed it updates their own UI instantly)
          if (prevComments.some(c => c.id === incomingComment.id)) {
            return prevComments;
          }
          // Add the new comment to the top of the list
          return [incomingComment, ...prevComments];
        });
      }
    }
  }, [lastMessage, taskId]);

  // Handle Comment Submission
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await apiClient.post(`/tasks/${taskId}/comments`, {
        comment: newComment.trim()
      });
      
      // Optimistically update our own UI instantly
      setComments([res.data, ...comments]);
      setNewComment('');
    } catch (err) {
      console.error(err);
      alert("Failed to post comment. Please try again.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle Task Deletion
  const handleDeleteTask = async () => {
    if (!window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) return;
    try {
      await apiClient.delete(`/tasks/${taskId}`);
      onClose(); 
    } catch (err) {
      console.error(err);
      alert("Failed to delete the task.");
    }
  };

  // Handle Task Update (Save Edit)
  const handleSaveChanges = async () => {
    if (!editForm.title.trim()) {
      alert("Task title cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      let formattedDate = null;
      if (editForm.due_date) {
        formattedDate = new Date(editForm.due_date).toISOString();
      }

      const response = await apiClient.patch(`/tasks/${taskId}`, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        priority: editForm.priority,
        due_date: formattedDate
      });

      setTaskData({
        ...taskData,
        task: response.data
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update task.");
    } finally {
      setIsSaving(false);
    }
  };

  // Assignment Handlers 
  const handleAssignUser = async (member) => {
    try {
      await apiClient.post(`/tasks/${taskId}/assign`, {
        user_ids: [member.user_id_int]
      });
      
      setTaskData(prev => ({
        ...prev,
        assignees: [
          ...prev.assignees, 
          { id: member.user_id_int, user_id: member.user_id, full_name: member.full_name, initials: member.initials }
        ]
      }));
      setShowAssignDropdown(false);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to assign user.");
    }
  };

  const handleUnassignUser = async (assigneeIntId) => {
    try {
      await apiClient.delete(`/tasks/${taskId}/assign/${assigneeIntId}`);
      setTaskData(prev => ({
        ...prev,
        assignees: prev.assignees.filter(a => a.id !== assigneeIntId)
      }));
    } catch (err) {
      console.error(err);
      alert("Failed to unassign user.");
    }
  };

  // Permissions Check
  const canEditOrDelete = user?.role === 'admin' || user?.role === 'moderator' || taskData?.task?.created_by === user?.id;

  // Filter out members who are already assigned to the task
  const availableMembersToAssign = projectMembers.filter(pm => 
    !taskData?.assignees.some(assignee => assignee.id === pm.user_id_int)
  );

  const getPriorityBadge = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold">High Priority</span>;
      case 'medium': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">Medium Priority</span>;
      case 'low': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold">Low Priority</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">Normal</span>;
    }
  };

  const formatColumnName = (colName) => {
    if (!colName) return '';
    return colName.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error || !taskData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500 gap-2">
            <AlertCircle className="w-8 h-8" />
            <p>{error || "Task not found."}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Close</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0 bg-white">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  {formatColumnName(taskData.task.column_name)}
                </span>
                
                {!isEditing ? (
                  <>
                    {getPriorityBadge(taskData.task.priority)}
                    {taskData.task.due_date && (
                      <span className="flex items-center gap-1 text-sm text-gray-500 border border-gray-200 px-3 py-1 rounded-full">
                        <Calendar className="w-4 h-4" />
                        Due {format(new Date(taskData.task.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex gap-2 items-center">
                    <select 
                      value={editForm.priority}
                      onChange={e => setEditForm({...editForm, priority: e.target.value})}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary"
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                    <input 
                      type="date" 
                      value={editForm.due_date}
                      onChange={e => setEditForm({...editForm, due_date: e.target.value})}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {canEditOrDelete && !isEditing && (
                  <>
                    <button onClick={() => setIsEditing(true)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit Task">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={handleDeleteTask} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Task">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                  </>
                )}
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
              
              {/* Left Column: Details */}
              <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200 custom-scrollbar">
                
                {!isEditing ? (
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">{taskData.task.title}</h2>
                ) : (
                  <input 
                    type="text"
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title: e.target.value})}
                    className="w-full text-2xl font-bold text-gray-900 mb-6 border-b-2 border-primary outline-none bg-blue-50/30 px-2 py-1 rounded-t"
                    placeholder="Task Title"
                  />
                )}
                
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Description</h3>
                  {!isEditing ? (
                    <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                      {taskData.task.description || "No description provided."}
                    </div>
                  ) : (
                    <textarea 
                      value={editForm.description}
                      onChange={e => setEditForm({...editForm, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none min-h-[150px] resize-y"
                      placeholder="Add details, criteria, or notes..."
                    />
                  )}
                </div>

                {isEditing && (
                  <div className="flex gap-3 mt-4">
                    <button onClick={handleSaveChanges} disabled={isSaving} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-70">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={isSaving} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                      Cancel
                    </button>
                  </div>
                )}

                {/* --- Assignees Section --- */}
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3 relative">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Assignees</h3>
                    
                    {canEditOrDelete && (
                      <div className="relative">
                        <button 
                          onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                          className="text-xs flex items-center gap-1 text-primary bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md font-medium transition-colors border border-blue-100"
                        >
                          <Plus className="w-3 h-3" /> Add Assignee
                        </button>
                        
                        {/* Assignment Dropdown Menu */}
                        {showAssignDropdown && (
                          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 p-2 z-50">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">Project Members</h4>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                              {availableMembersToAssign.length === 0 ? (
                                <p className="text-xs text-gray-500 px-2 py-2 italic">All project members are already assigned.</p>
                              ) : (
                                availableMembersToAssign.map(member => (
                                  <button
                                    key={member.id}
                                    onClick={() => handleAssignUser(member)}
                                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-md transition-colors"
                                  >
                                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                      {member.initials}
                                    </div>
                                    <div className="truncate">
                                      <p className="text-sm font-medium text-gray-900 truncate">{member.full_name}</p>
                                      <p className="text-[10px] text-gray-500 truncate">{member.user_id}</p>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Render Assigned Users */}
                  {taskData.assignees && taskData.assignees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {taskData.assignees.map((assignee, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full py-1 pr-3 pl-1 group">
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {assignee.initials}
                          </div>
                          <span className="text-sm font-medium text-slate-700">{assignee.full_name}</span>
                          
                          {canEditOrDelete && (
                            <button 
                              onClick={() => handleUnassignUser(assignee.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity ml-1 bg-white hover:bg-red-50 rounded-full p-0.5"
                              title="Remove assignee"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No one assigned to this task yet.</p>
                  )}
                </div>
              </div>

              {/* Right Column: Comments */}
              <div className="w-full md:w-96 flex flex-col bg-slate-50 shrink-0">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2 text-gray-700 font-semibold bg-white">
                  <MessageSquare className="w-4 h-4" /> Activity & Comments
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {comments.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm mt-4">No comments yet.</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <span className="font-semibold text-sm text-gray-900 truncate">{comment.user_id}</span>
                          <span className="text-xs text-gray-400 shrink-0">{format(new Date(comment.created_at), 'MMM d, h:mm a')}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddComment} className="p-4 bg-white border-t border-gray-200">
                  <div className="relative">
                    <textarea
                      placeholder="Add a comment..."
                      className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                      rows="3"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment(e);
                        }
                      }}
                    ></textarea>
                    <button type="submit" disabled={!newComment.trim() || submittingComment} className="absolute bottom-3 right-3 p-2 bg-primary text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}