import { Bell, Search } from 'lucide-react';

// We pass down a "title" prop so the page can tell the header what to display
export default function Header({ title = "Dashboard" }) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
      
      {/* Dynamic Page Title */}
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      </div>

      {/* Header Actions (Search, Notifications) */}
      <div className="flex items-center gap-4">
        
        {/* Search Bar - Visual only for now */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search..."
            className="block w-64 pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-gray-50"
          />
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
          <Bell className="h-5 w-5" />
          {/* Red dot indicator for unread notifications */}
          <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>
        
      </div>
    </header>
  );
}