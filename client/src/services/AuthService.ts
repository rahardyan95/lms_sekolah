import { api } from '../lib/ApiClient';
import type { UserRole } from '../types';

interface LoginResponse {
  data: { token: string; portal: string; user: { roles: string[] } };
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

export class AuthService {
  static async login(identifier: string, password: string): Promise<{ role: UserRole; portal: string }> {
    try {
      const res = await api.post<LoginResponse>('/login', { identifier, password });
      sessionStorage.setItem('lms_token', res.data.data.token);
      sessionStorage.setItem('lms_api', '1');
      const role = (res.data.data.user.roles?.[0] ?? 'super_admin') as UserRole;
      return { role, portal: res.data.data.portal };
    } catch {
      sessionStorage.setItem('lms_api', '0');
      throw new Error('API_OFFLINE');
    }
  }

  static async me(): Promise<UserRole | null> {
    try {
      const res = await api.get('/me');
      return (res.data.data.roles?.[0] ?? null) as UserRole | null;
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
      sessionStorage.removeItem('lms_token');
    }
  }

  static async requestOtp(identifier: string): Promise<string | null> {
    const res = await api.post('/otp/request', { identifier });
    return (res.data.data.debug_code as string | undefined) ?? null;
  }

  static async verifyOtp(identifier: string, code: string): Promise<boolean> {
    const res = await api.post('/otp/verify', { identifier, code });
    return res.data.data.verified === true;
  }

  static portalToRole(portal: string): UserRole {
    return ROLE_FALLBACK[portal] ?? 'super_admin';
  }

  static isApiOnline(): boolean {
    return sessionStorage.getItem('lms_api') !== '0';
  }
}
