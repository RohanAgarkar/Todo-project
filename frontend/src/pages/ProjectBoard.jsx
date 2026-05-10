import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext } from '@hello-pangea/dnd';
import apiClient from '../api/client';
import BoardColumn from '../components/board/BoardColumn';
import TaskDetailsModal from '../components/board/TaskDetailsModal';
import CreateTaskModal from '../components/board/CreateTaskModal';
import { WebSocketContext } from '../context/WebSocketContext';
import { Loader2, AlertCircle, WifiOff, LayoutTemplate, Plus } from 'lucide-react';

export default function ProjectBoard() {
  const { id } = useParams();
  const { lastMessage, isConnected } = useContext(WebSocketContext);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal States
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createColumnDefault, setCreateColumnDefault] = useState('todo');
  
  const [boardData, setBoardData] = useState({
    todo: [],
    in_progress: [],
    review: [],
    done: []
  });

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(`/tasks/project/${id}`);
        const tasks = response.data.tasks || [];
        
        const grouped = { todo: [], in_progress: [], review: [], done: [] };

        tasks.forEach(item => {
          const taskData = { ...item.task, assignees: item.assignees };
          const colName = taskData.column_name.toLowerCase();
          
          if (grouped[colName]) {
            grouped[colName].push(taskData);
          } else {
            grouped.todo.push(taskData); 
          }
        });

        setBoardData(grouped);
      } catch (err) {
        console.error("Failed to load project tasks:", err);
        setError("Failed to load the Kanban board. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchTasks();
  }, [id]);

  // LIVE WEBSOCKET LISTENER (Upgraded for Task CRUD)
  useEffect(() => {
    if (!lastMessage) return;
    
    const eventType = lastMessage.event;
    const payload = lastMessage.data || lastMessage;

    // Ignore events not belonging to this project
    const eventProjectId = payload?.task?.project_id || payload?.project_id;
    if (eventProjectId !== parseInt(id)) return;

    setBoardData(prevBoard => {
      // Deep copy board state to avoid mutating React state directly
      const updatedBoard = {
        todo: [...prevBoard.todo],
        in_progress: [...prevBoard.in_progress],
        review: [...prevBoard.review],
        done: [...prevBoard.done]
      };

      if (eventType === "task_moved" || eventType === "task_updated") {
        const { task } = payload;
        const newColName = task.column_name.toLowerCase();
        
        // Find and remove task from old column
        let taskToMove = null;
        for (const col in updatedBoard) {
          const index = updatedBoard[col].findIndex(t => t.id === task.id);
          if (index !== -1) {
            taskToMove = updatedBoard[col].splice(index, 1)[0];
            break;
          }
        }

        // Apply updates and push to new column
        if (taskToMove && updatedBoard[newColName]) {
          const updatedTask = { ...taskToMove, ...task, column_name: newColName };
          updatedBoard[newColName].push(updatedTask);
        }
      } 
      else if (eventType === "task_created") {
        // Format the new task and push it to the correct column
        const newTask = { ...payload.task, assignees: [] };
        const colName = newTask.column_name.toLowerCase();
        if (updatedBoard[colName]) {
          updatedBoard[colName].push(newTask);
        }
      }
      else if (eventType === "task_deleted") {
        // Remove task from whichever column it is in
        const { task } = payload;
        for (const col in updatedBoard) {
          updatedBoard[col] = updatedBoard[col].filter(t => t.id !== task.id);
        }
        // If the user had this task open in the modal, close the modal
        if (selectedTaskId === task.id) {
            setSelectedTaskId(null);
        }
      }

      return updatedBoard;
    });
  }, [lastMessage, id]);

  const handleDragEnd = async (result) => {
    if (!isConnected) {
      alert("You are currently offline. Please wait for the connection to restore before moving tasks.");
      return;
    }

    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const sourceColumn = [...boardData[source.droppableId]];
    const destColumn = [...boardData[destination.droppableId]];
    
    const [movedTask] = sourceColumn.splice(source.index, 1);
    movedTask.column_name = destination.droppableId;
    destColumn.splice(destination.index, 0, movedTask);

    setBoardData({
      ...boardData,
      [source.droppableId]: sourceColumn,
      [destination.droppableId]: destColumn,
    });

    try {
      await apiClient.patch(`/tasks/${draggableId}/move`, {
        column_name: destination.droppableId 
      });
    } catch (err) {
      console.error(err);
      alert("Failed to sync task movement with the server.");
    }
  };

  const openCreateModal = (columnId = 'todo') => {
    setCreateColumnDefault(columnId);
    setIsCreateModalOpen(true);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="h-full flex items-center justify-center text-red-500 flex-col gap-2"><AlertCircle className="w-8 h-8" /><p>{error}</p></div>;
  }

  const totalTasks = boardData.todo.length + boardData.in_progress.length + boardData.review.length + boardData.done.length;

  return (
    <div className="flex flex-col h-full relative">
      
      {/* Top action bar */}
      <div className="flex justify-end mb-4 shrink-0 px-2">
         <button 
            onClick={() => openCreateModal('todo')}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
      </div>

      {!isConnected && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 shadow-sm shrink-0">
          <div className="bg-red-100 p-2 rounded-full shrink-0"><WifiOff className="w-5 h-5 text-red-600" /></div>
          <div>
            <h3 className="text-sm font-bold text-red-900">Disconnected</h3>
            <p className="text-xs text-red-700 mt-0.5">Unable to connect to the local server. Drag and drop is temporarily disabled.</p>
          </div>
        </div>
      )}

      {totalTasks === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center bg-white rounded-xl border border-gray-200 shadow-sm p-10">
          <div className="bg-blue-50 p-4 rounded-full mb-4"><LayoutTemplate className="w-12 h-12 text-blue-500" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Tasks Yet</h2>
          <p className="text-gray-500 text-sm max-w-sm mb-6">This project doesn't have any tasks. Add your first task to get started.</p>
          <button onClick={() => openCreateModal('todo')} className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm">
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 h-full overflow-x-auto pb-4 items-start">
            <BoardColumn columnId="todo" title="To Do" tasks={boardData.todo} onTaskClick={setSelectedTaskId} onAddTask={openCreateModal} />
            <BoardColumn columnId="in_progress" title="In Progress" tasks={boardData.in_progress} onTaskClick={setSelectedTaskId} onAddTask={openCreateModal} />
            <BoardColumn columnId="review" title="Review" tasks={boardData.review} onTaskClick={setSelectedTaskId} onAddTask={openCreateModal} />
            <BoardColumn columnId="done" title="Done" tasks={boardData.done} onTaskClick={setSelectedTaskId} onAddTask={openCreateModal} />
          </div>
        </DragDropContext>
      )}

      {/* Modals */}
      {selectedTaskId && <TaskDetailsModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />}
      {isCreateModalOpen && <CreateTaskModal projectId={id} defaultColumn={createColumnDefault} onClose={() => setIsCreateModalOpen(false)} />}
    </div>
  );
}