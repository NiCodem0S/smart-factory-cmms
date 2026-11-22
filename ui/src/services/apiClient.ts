import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse } from '../types/auth';

const baseURL = import.meta.env.VITE_API_BASE_URL;
if (!baseURL) throw new Error('VITE_API_BASE_URL is not defined in the environment variables.');
let inMemoryToken: string | null = null;
let sessionGeneration = 0;
export const setAccessToken = (token: string | null) => { inMemoryToken = token; sessionGeneration++; };
export const getAccessToken = () => inMemoryToken;
let onSessionExpiredCallback: (() => void) | null = null;
export const setOnSessionExpired = (callback: () => void) => { onSessionExpiredCallback = callback; };

// HTTP requests and SignalR share one refresh so a rotating cookie is never consumed twice.
let pendingRefresh: Promise<AuthResponse> | null = null;
export function refreshSession(): Promise<AuthResponse> {
    if (pendingRefresh) return pendingRefresh;
    const generation = sessionGeneration;
    pendingRefresh = axios.post<AuthResponse>(`${baseURL}/auth/refresh`, {}, { withCredentials: true, timeout: 15000 })
        .then(({ data }) => {
            if (generation !== sessionGeneration) {
                throw new Error('Session has changed.');
            }
            inMemoryToken = data.token;
            return data;
        })
        .catch(error => {
            if (generation === sessionGeneration) { setAccessToken(null); onSessionExpiredCallback?.(); }
            throw error;
        })
        .finally(() => { pendingRefresh = null; });
    return pendingRefresh;
}
export async function getLiveAccessToken(): Promise<string> {
    if (inMemoryToken) {
        try {
            const payload = inMemoryToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const expiry = JSON.parse(atob(payload)).exp;
            if (expiry * 1000 > Date.now() + 30000) return inMemoryToken;
        } catch { /* An expired or invalid token is renewed through the authenticated cookie. */ }
    }
    return (await refreshSession()).token;
}
export const apiClient = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' }, timeout: 15000, withCredentials: true });
apiClient.interceptors.request.use(config => {
    if (inMemoryToken) config.headers.Authorization = `Bearer ${inMemoryToken}`;
    return config;
});
apiClient.interceptors.response.use(response => response, async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retry || /\/auth\/(login|refresh)/.test(original.url ?? ''))
        return Promise.reject(error);
    original._retry = true;
    const { token } = await refreshSession();
    original.headers.Authorization = `Bearer ${token}`;
    return apiClient(original);
});
