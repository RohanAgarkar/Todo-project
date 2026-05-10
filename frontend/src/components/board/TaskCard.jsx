import { Draggable } from '@hello-pangea/dnd';
import { MessageSquare, Calendar } from 'lucide-react';
import { format } from 'date-fns';

// Added onClick to props
export default function TaskCard({ task, index, onClick }) {
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          // Attach the onClick handler here
          onClick={onClick}
          className={`bg-white p-4 rounded-lg shadow-sm border ${
            snapshot.isDragging ? 'border-primary shadow-md rotate-2' : 'border-gray-200'
          } mb-3 cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors`}
        >
          <div className="flex justify-between items-start mb-2 gap-2">
            <h4 className="font-medium text-sm text-gray-900 leading-snug">
              {task.title}
            </h4>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${getPriorityColor(task.priority)}`}>
              {task.priority || 'Normal'}
            </span>
          </div>

          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-4 mt-2">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(task.due_date), 'MMM d, yyyy')}</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="flex -space-x-2">
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees.map((assignee, i) => (
                  <div 
                    key={i} 
                    className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600"
                    title={assignee.full_name}
                  >
                    {assignee.initials}
                  </div>
                ))
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center"></div>
              )}
            </div>

            <div className="flex items-center gap-1 text-gray-400 text-xs font-medium">
              <MessageSquare className="w-3 h-3" />
              <span>0</span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}