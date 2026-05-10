import Sidebar from './Sidebar';
import Header from './Header';

// The "children" prop is a special React prop. It represents whatever 
// components are nested inside this layout wrapper.
export default function MainLayout({ children, title }) {
  return (
    <div className="flex h-screen bg-board overflow-hidden">
      
      {/* Left Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Header */}
        <Header title={title} />
        
        {/* Page Content goes here. It scrolls independently of the sidebar. */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-board p-8">
          {children}
        </main>
        
      </div>
    </div>
  );
}