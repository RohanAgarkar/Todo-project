import { createContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

// 1. Create the Context. This is like an empty box that will hold our auth data.
export const AuthContext = createContext();

// 2. Create a Provider component. This wraps our app and provides the data.
export const AuthProvider = ({ children }) => {
  // State holds data that changes over time. 
  // When state changes, React automatically updates the UI.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // True while we check if user is already logged in

  // useEffect runs side-effects. The empty array [] means it runs exactly ONCE when the app loads.
  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // If we have a token, ask the backend who this user is
          const response = await apiClient.get('/auth/me');
          setUser(response.data); // Save the user info in state
        } catch (error) {
          // If the token is invalid or expired, clear it out
          console.error("Token invalid or expired", error);
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      // Finished checking, stop loading
      setLoading(false);
    };

    checkLoggedIn();
  }, []);

  // The login function. It takes credentials, hits the API, and saves the token.
  const login = async (username, password) => {
    try {
      // FastAPI expects OAuth2 form data (x-www-form-urlencoded), not JSON for login
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      // Save token to browser storage
      localStorage.setItem('token', response.data.access_token);
      
      // Now fetch the actual user profile
      const userResponse = await apiClient.get('/auth/me');
      setUser(userResponse.data);
      
      return { success: true };
    } catch (error) {
      // Return error message so the UI can show it
      return { 
        success: false, 
        error: error.response?.data?.detail || "An error occurred during login." 
      };
    }
  };

  // The logout function
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // The data we are making available to the rest of the application
  const value = {
    user,
    loading,
    login,
    logout
  };

  // We wrap the children (the rest of our app) with our Context Provider
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};