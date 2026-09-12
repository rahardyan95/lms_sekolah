import { api, ensureCsrf } from '../lib/ApiClient';
import type { UserRole } from '../types';
import { TokenStorage } from './TokenStorage';

interface LoginResponse {
  data: { token: string; portal: string; user: { name?: string; roles: string[] } };
}

/** Identitas sesi dari server (satu-satunya sumber): nama + role. */
export interface SessionProfile {
  name: string;
  role: UserRole;
}

const ROLE_FALLBACK: Record<string, UserRole> = {
  dashboard: 'super_admin',
  student: 'siswa',
  parent: 'orang_tua',
  spmb: 'calon_siswa',
  academic: 'guru',
  finance: 'bendahara',
  attendance: 'operator',
};

const ROLE_MISSING_MESSAGE = 'Akun ini belum memiliki peran akses. Hubungi admin sekolah.';

function errorMessage(err: unknown): string | null {
  const server = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof server === 'string' && server.length > 0 && server !== 'Unauthenticated.'
    ? server
    : null;
}

export class AuthService {
  /**
   * Login web hibrida: token disimpan di cookie httpOnly server
   * (header X-Web-Client), storage lokal HANYA menyimpan mode sesi.
   * XSS tidak bisa mencuri token dari sini.
   */
  static async login(identifier: string, password: string): Promise<{ role: UserRole; portal: string; name: string }> {
    try {
      const res = await api.post<LoginResponse>(
        '/login',
        { identifier, password },
        { headers: { 'X-Web-Client': '1' } }
      );
      // Role hilang bukan alasan memilih UI paling berkuasa: login ditolak.
      const role = res.data.data.user.roles?.[0] as UserRole | undefined;
      if (!role) {
        TokenStorage.clearToken();
        throw new Error(ROLE_MISSING_MESSAGE);
      }
      TokenStorage.setWebSession();
      await ensureCsrf();
      return { role, portal: res.data.data.portal, name: res.data.data.user.name ?? identifier };
    } catch (err) {
      // Respons sukses tanpa role bukan gangguan jaringan: jangan tandai API offline.
      if (err instanceof Error && err.message === ROLE_MISSING_MESSAGE) {
        TokenStorage.clearToken();
        throw err;
      }
      TokenStorage.markApiOffline();
      throw new Error(errorMessage(err) ?? 'API_OFFLINE');
    }
  }

  /** Identitas sesi aktif dari server (nama + role) — bukan metadata hardcoded UI. */
  static async profile(): Promise<SessionProfile | null> {
    try {
      const res = await api.get('/me');
      const data = res.data.data as { name?: string; roles?: string[] } | undefined;
      const role = (data?.roles?.[0] ?? null) as UserRole | null;
      if (!role) return null;

      return { name: data?.name ?? '', role };
    } catch {
      return null;
    }
  }

  static async logout(): Promise<void> {
    try {
      await api.post('/logout');
    } catch {
      /* abaikan, tetap bersihkan token lokal */
    } finally {
      TokenStorage.clearToken();
    }
  }

  /** Kirim OTP ke WhatsApp orang tua. `debug_code` hanya dikembalikan server saat env local/testing. */
  static async requestOtp(identifier: string): Promise<string | null> {
    const res = await api.post('/otp/request', { identifier });
    return (res.data.data.debug_code as string | undefined) ?? null;
  }

  static async verifyOtp(identifier: string, code: string): Promise<boolean> {
    const res = await api.post('/otp/verify', { identifier, code }, { headers: { 'X-Web-Client': '1' } });
    const data = res.data.data;
    // Sesi orang tua juga httpOnly; jangan simpan Bearer di storage.
    if (data?.token) {
      TokenStorage.setWebSession();
      await ensureCsrf();
    }
    return data.verified === true;
  }

  /** Minta tautan reset kata sandi (backend mengirim email dengan URL SPA). */
  static async forgotPassword(identifier: string): Promise<void> {
    try {
      await api.post('/password/forgot', { identifier });
    } catch (err) {
      throw new Error(errorMessage(err) ?? 'Terjadi kesalahan saat mengirim tautan reset.');
    }
  }

  /** Konsumsi token reset dari email: set password baru, cabut sesi lama. */
  static async resetPassword(email: string, token: string, password: string): Promise<void> {
    try {
      await api.post('/password/reset', { email, token, password, password_confirmation: password });
    } catch (err) {
      throw new Error(errorMessage(err) ?? 'Tautan reset tidak valid atau sudah kedaluwarsa.');
    }
  }

  static portalToRole(portal: string): UserRole {
    // Portal tak dikenal = belum ada hak akses, bukan super_admin.
    return ROLE_FALLBACK[portal] ?? 'public';
  }

  static isApiOnline(): boolean {
    return TokenStorage.isApiOnline();
  }
}
