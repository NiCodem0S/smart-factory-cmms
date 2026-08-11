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
    timeout: 5000,
});