import React, { createContext, useState, ReactNode, useEffect } from 'react';
import { User, AuthContextType } from './types';
import { apiClient, LoginRequest, SignupRequest } from '../api/client';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  
  // Check if authentication is disabled for testing
  const isAuthDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';

  const login = async (email: string, password: string) => {
    try {
      const loginRequest: LoginRequest = {
        username: email, // Using email as username for now
        password: password
      };
      
      const response = await apiClient.login(loginRequest);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (response.data) {
        const user: User = {
          username: response.data.username,
        };
        
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      // Split name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const signupRequest: SignupRequest = {
        username: email, // Using email as username for now
        email: email,
        password: password,
        first_name: firstName,
        last_name: lastName
      };
      
      const response = await apiClient.signup(signupRequest);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (response.data && response.data.verification_required) {
        // User needs to verify email before they can log in
        throw new Error('Please check your email for verification link then try logging in.');
      }
      
      // If no verification required, proceed with login
      await login(email, password);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await apiClient.logout();
    setUser(null);
    localStorage.removeItem('user');
  };

  // Check for existing user on mount
  useEffect(() => {
    if (isAuthDisabled) {
      // Set a mock user when auth is disabled for testing
      const mockUser: User = {
        username: 'test@example.com',
      };
      setUser(mockUser);
      return;
    }
    
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('user');
      }
    }
  }, [isAuthDisabled]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    signup,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 