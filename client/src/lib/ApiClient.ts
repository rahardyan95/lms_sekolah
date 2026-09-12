import axios, { type AxiosInstance } from 'axios';
import { TokenStorage } from '../services/TokenStorage';

const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;

// Fail-fast: build production tanpa VITE_API_URL tidak boleh diam-diam
// menunjuk localhost — aplikasi akan rusak tanpa pesan yang jelas.
if (import.meta.env.PROD && !envApiUrl) {
  throw new Error('VITE_API_URL wajib diisi saat build production (client/.env atau build-arg Docker).');
}

const baseURL = envApiUrl ?? 'http://localhost:8000/api/v1';

function newRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Endpoint yang memang memakai kredensial salah — 401 di sini bukan "sesi habis". */
const AUTH_ENDPOINT_PATTERNS = ['/login', '/otp/', '/password/', '/sanctum/'];

function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;
  return AUTH_ENDPOINT_PATTERNS.some((pattern) => url.includes(pattern));
}

export class ApiClient {
  private static instance: ApiClient;
  readonly http: AxiosInstance;
  private csrfReady = false;

  private constructor() {
    // `withXSRFToken` wajib: mutasi berbasis cookie ditolak 419 CSRF_MISMATCH
    // bila header X-XSRF-TOKEN tidak dikirim. Axios hanya mengirimnya otomatis
    // untuk URL same-origin, sedangkan dev memakai origin Vite (:5173) → API
    // (:8000) yang cross-origin; produksi (Caddy) same-origin → tetap aman.
    this.http = axios.create({ baseURL, withCredentials: true, withXSRFToken: true, timeout: 15000 });

    this.http.interceptors.request.use((config) => {
      config.headers.set('X-Request-ID', newRequestId());
      // Mode web hibrida: auth lewat cookie httpOnly — JANGAN kirim Bearer
      // dari storage (tidak ada). Bearer hanya untuk klien non-web.
      const token = TokenStorage.getToken();
      if (token) config.headers.set('Authorization', `Bearer ${token}`);
      return config;
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        const code = err?.response?.data?.errors?.code;
        const isAuthError = code === 'AUTH_REQUIRED' || err?.response?.status === 401;

        if (isAuthError) {
          // Sesi lenyap di tengah kerja (token/cookie kedaluwarsa): bersihkan
          // state lokal lalu beri tahu UI agar kembali ke login + toast —
          // jangan biarkan pengguna menatap layar mati tanpa penjelasan.
          const hadSession = TokenStorage.getToken() !== null || TokenStorage.isWebMode();
          TokenStorage.clearToken();

          if (hadSession && !isAuthEndpoint(err?.config?.url)) {
            window.dispatchEvent(new CustomEvent('lms:session-expired'));
          }
        }

        return Promise.reject(err);
      },
    );
  }

  /** Ambil cookie CSRF Sanctum sekali per sesi (dibutuhkan mutasi via cookie). */
  async ensureCsrf(): Promise<void> {
    if (this.csrfReady) return;
    try {
      const root = baseURL.replace(/\/api\/v1\/?$/, '');
      await this.http.get(`${root}/sanctum/csrf-cookie`);
    } catch {
      /* offline — mutasi akan gagal jujur di server */
    } finally {
      this.csrfReady = true;
    }
  }

  static get(): ApiClient {
    if (!ApiClient.instance) ApiClient.instance = new ApiClient();
    return ApiClient.instance;
  }
}

export const api = ApiClient.get().http;
export const ensureCsrf = (): Promise<void> => ApiClient.get().ensureCsrf();
