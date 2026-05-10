import { createContext, useEffect, useState, useContext, useRef } from 'react';
import { AuthContext } from './AuthContext';

export const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const reconnectTimeout = useRef(null);

  useEffect(() => {
    if (!user) return;

    let ws;

    const connectWebSocket = () => {
      setIsConnecting(true);
      
      // dynamically grab the user-defined IP from local storage
      const storedIp = localStorage.getItem('server_ip') || '192.168.1.10:8000';
      // Strip http:// or https:// if the user accidentally typed it
      const cleanIp = storedIp.replace(/^https?:\/\//, '');
      
      ws = new WebSocket(`ws://${cleanIp}/ws/`);

      ws.onopen = () => {
        console.log('🟢 WebSocket Connected Successfully');
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
        } catch (e) {
          console.error("Failed to parse WebSocket message", e);
        }
      };

      ws.onclose = () => {
        console.log('🔴 WebSocket Disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        
        reconnectTimeout.current = setTimeout(() => {
          console.log('🔄 Attempting to reconnect...');
          connectWebSocket();
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('⚠️ WebSocket Error:', error);
      };

      setSocket(ws);
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout.current);
      if (ws && ws.readyState === 1) {
        ws.close();
      }
    };
  }, [user]);

  return (
    <WebSocketContext.Provider value={{ socket, lastMessage, isConnected, isConnecting }}>
      {children}
    </WebSocketContext.Provider>
  );
};