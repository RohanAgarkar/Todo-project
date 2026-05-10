import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { User, Lock, AlertCircle, CheckCircle2, Server, X } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dynamic Server States
  const [serverIp, setServerIp] = useState(localStorage.getItem('server_ip') || '192.168.1.10:8000');
  const [isEditingServer, setIsEditingServer] = useState(false);
  const [tempIp, setTempIp] = useState(serverIp);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  // If local storage didn't have an IP, initialize it on first load
  useEffect(() => {
    if (!localStorage.getItem('server_ip')) {
      localStorage.setItem('server_ip', '192.168.1.10:8000');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(username, password);

    if (result.success) {
      navigate('/');
    } else {
      // Improve the default error message to warn them about server connection issues
      if (result.error === "Network Error") {
        setError(`Unable to connect. Please check if the server IP (${serverIp}) is correct and running.`);
      } else {
        setError(result.error);
      }
      setIsSubmitting(false);
    }
  };

  const handleSaveServerIp = () => {
    const cleanedIp = tempIp.replace(/^https?:\/\//, '').trim();
    if (!cleanedIp) return;
    
    setServerIp(cleanedIp);
    localStorage.setItem('server_ip', cleanedIp);
    setIsEditingServer(false);
  };

  return (
    <div className="min-h-screen bg-board flex flex-col justify-center items-center relative p-4">
      
      {/* Main Login Card */}
      <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
        
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex gap-1">
              <div className="w-3 h-8 bg-primary rounded-full"></div>
              <div className="w-3 h-10 bg-primary rounded-full -mt-1"></div>
              <div className="w-3 h-8 bg-primary rounded-full"></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">LAN Kanban</h1>
          <p className="text-gray-500 text-sm mt-1">Task Manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <User className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Username"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              placeholder="Password"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center text-gray-600 cursor-pointer">
              <input type="checkbox" className="mr-2 rounded text-primary focus:ring-primary" />
              Remember me
            </label>
            <a href="#" className="text-primary hover:underline font-medium">
              Forgot password?
            </a>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="leading-snug">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full text-white bg-primary py-2.5 rounded-lg font-medium transition-colors ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Local Server Indicator & Configurator matching Wireframe 1 */}
      <div className="absolute bottom-6 left-6 right-6 sm:right-auto bg-white p-3 rounded-xl shadow-sm border border-gray-200">
        
        {!isEditingServer ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <span className="font-medium">Connected to {serverIp}</span>
              <span className="text-gray-400">(Local Server)</span>
            </div>
            <button 
              onClick={() => { setTempIp(serverIp); setIsEditingServer(true); }}
              className="text-xs font-semibold text-primary bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
            >
              Change Server
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                <Server className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text" 
                value={tempIp}
                onChange={e => setTempIp(e.target.value)}
                autoFocus
                placeholder="e.g. 192.168.1.10:8000"
                className="w-64 pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <button 
              onClick={handleSaveServerIp}
              className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
            >
              Save
            </button>
            <button 
              onClick={() => setIsEditingServer(false)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
      
    </div>
  );
}