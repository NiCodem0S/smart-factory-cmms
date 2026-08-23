import { apiClient } from './apiClient';
import { AuthResponse, LoginCredentials, User } from '../types/auth';

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
        return response.data;
    },

    async getMe(): Promise<User> {
        const response = await apiClient.get<User>('/auth/me');
        return response.data;
    }
};
