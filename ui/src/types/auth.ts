export type UserRole = 'SuperAdmin' | 'HallAdmin' | 'Technician';

export interface User {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    factoryHallId?: string | null;
    factoryHallName?: string | null;
    isActive: boolean;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
    factoryHallId?: string | null;
}

export interface AuthResponse {
    token: string;
    user: User;
}
