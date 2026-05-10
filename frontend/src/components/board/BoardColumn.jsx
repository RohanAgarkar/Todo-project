import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { Plus } from 'lucide-react';

// Added onAddTask prop
export default function BoardColumn({ columnId, title, tasks, onTaskClick, onAddTask }) {
  const getDotColor = (id) => {
    switch (id) {
      case 'todo': return 'bg-gray-400';
      case 'in_progress': return 'bg-blue-500';
      case 'review': return 'bg-yellow-400';
      case 'done': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex flex-col w-80 shrink-0">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${getDotColor(columnId)}`}></div>
          <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
        </div>
        <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 rounded-xl p-2 transition-colors min-h-[500px] flex flex-col ${
              snapshot.isDraggingOver ? 'bg-slate-200/50' : 'bg-transparent'
            }`}
          >
            {tasks.map((task, index) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                index={index} 
                onClick={() => onTaskClick(task.id)} 
              />
            ))}
            
            {provided.placeholder}

            {/* NEW: Add Task Button at the bottom of the column */}
            <button 
              onClick={() => onAddTask(columnId)}
              className="mt-2 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-200/70 p-2 rounded-lg transition-colors w-full"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        )}
      </Droppable>
    </div>
  );
}