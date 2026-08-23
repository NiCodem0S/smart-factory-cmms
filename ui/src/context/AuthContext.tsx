import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, RegisterCredentials } from '../types/auth';
import { authService } from '../services/authService';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('cmms_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [token, setToken] = useState<string | null>(() => {
        return localStorage.getItem('cmms_token');
    });
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const verifyAuth = async () => {
            const storedToken = localStorage.getItem('cmms_token');
            if (storedToken) {
                try {
                    const currentUser = await authService.getMe();
                    setUser(currentUser);
                    localStorage.setItem('cmms_user', JSON.stringify(currentUser));
                } catch {
                    localStorage.removeItem('cmms_token');
                    localStorage.removeItem('cmms_user');
                    setUser(null);
                    setToken(null);
                }
            } else {
                setUser(null);
                setToken(null);
            }
            setIsLoading(false);
        };

        verifyAuth();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        const response = await authService.login(credentials);
        localStorage.setItem('cmms_token', response.token);
        localStorage.setItem('cmms_user', JSON.stringify(response.user));
        setToken(response.token);
        setUser(response.user);
    };

    const logout = () => {
        localStorage.removeItem('cmms_token');
        localStorage.removeItem('cmms_user');
        setUser(null);
        setToken(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                isAuthenticated: !!token && !!user,
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
