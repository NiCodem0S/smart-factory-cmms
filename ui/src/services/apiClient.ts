import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
    throw new Error('VITE_API_BASE_URL is not defined in the environment variables.');
}

let inMemoryToken: string | null = null;

export const setAccessToken = (token: string | null) => {
    inMemoryToken = token
}

export const getAccessToken = () => inMemoryToken

let onSessionExpiredCallback: (() => void) | null = null;

export const setOnSessionExpired = (callback: () => void) => {
    onSessionExpiredCallback = callback
}

export const apiClient = axios.create({
    baseURL: baseURL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 15000,
    withCredentials: true
});

apiClient.interceptors.request.use((config) => {
    if (inMemoryToken && config.headers) {
        config.headers.Authorization = `Bearer ${inMemoryToken}`
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

let isRefreshing = false;
let failedQueue: Array<
    {
        resolve: (token: string | null) => void;
        reject: (error: any) => void;
    }
> = [];
const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (originalRequest.headers && token) {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                        }
                        return apiClient(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;
            try {
                const { data } = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
                const newToken = data.token;
                setAccessToken(newToken);
                processQueue(null, newToken);

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                }

                return apiClient(originalRequest);
            }
            catch (refreshError) {
                processQueue(refreshError, null);
                setAccessToken(null);
                onSessionExpiredCallback?.();
                return Promise.reject(refreshError);
            }
            finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);