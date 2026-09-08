import axios, { type AxiosInstance } from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class ApiClient {
  private static instance: ApiClient;
  readonly http: AxiosInstance;

  private constructor() {
    this.http = axios.create({ baseURL, withCredentials: true, timeout: 15000 });

    this.http.interceptors.request.use((config) => {
      config.headers.set('X-Request-ID', newRequestId());
      const token = sessionStorage.getItem('lms_token');
      if (token) config.headers.set('Authorization', `Bearer ${token}`);
      return config;
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        const code = err?.response?.data?.errors?.code;
        if (code === 'AUTH_REQUIRED' || err?.response?.status === 401) {
          sessionStorage.removeItem('lms_token');
        }
        return Promise.reject(err);
      },
    );
  }

  static get(): ApiClient {
    if (!ApiClient.instance) ApiClient.instance = new ApiClient();
    return ApiClient.instance;
  }
}

export const api = ApiClient.get().http;
