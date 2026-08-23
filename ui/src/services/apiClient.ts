import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
    throw new Error('VITE_API_BASE_URL is not defined in the environment variables.');
}

export const apiClient = axios.create({
    baseURL: baseURL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('cmms_token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('cmms_token');
            localStorage.removeItem('cmms_user');
        }
        return Promise.reject(error);
    }
);