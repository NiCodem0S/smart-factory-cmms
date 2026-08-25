import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, LoginCredentials } from '../types/auth';
import { authService } from '../services/authService';
import { setAccessToken, setOnSessionExpired } from '../services/apiClient';

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } catch (err) {
            console.error("Logout error:", err);
        } finally {
            setUser(null);
            setToken(null);
            setAccessToken(null);
        }
    }, []);

    // Rejestrujemy callback dla interceptora (gdy refresh token wygaśnie w tle)
    useEffect(() => {
        setOnSessionExpired(() => {
            setUser(null);
            setToken(null);
            setAccessToken(null);
        });
    }, []);

    // Ciche logowanie (Silent Refresh) przy starcie aplikacji (F5)
    useEffect(() => {
        const initAuth = async () => {
            try {
                const data = await authService.refreshToken();
                setUser(data.user);
                setToken(data.token);
                setAccessToken(data.token);
            } catch {
                setUser(null);
                setToken(null);
                setAccessToken(null);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        const response = await authService.login(credentials);
        setUser(response.user);
        setToken(response.token);
        setAccessToken(response.token);
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
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
