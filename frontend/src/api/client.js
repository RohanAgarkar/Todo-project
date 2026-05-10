import axios from 'axios';

// Helper function to dynamically get the current server IP
const getServerUrl = () => {
  const storedIp = localStorage.getItem('server_ip');
  // Default to a typical local IP if the user hasn't set one yet
  return storedIp ? `http://${storedIp}` : 'http://192.168.1.10:8000';
};

const apiClient = axios.create({
  // We set an initial base URL, but we will overwrite it in the interceptor
  baseURL: getServerUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Before ANY request is sent, this function runs.
apiClient.interceptors.request.use((config) => {
  // Always fetch the freshest IP in case the user just changed it on the login screen
  config.baseURL = getServerUrl();
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default apiClient;