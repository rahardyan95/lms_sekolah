import { AuthService, type SessionProfile } from './AuthService';
import { TokenStorage } from './TokenStorage';
import { ensureCsrf } from '../lib/ApiClient';

/**
 * OOP single source of truth status login SPA.
 * Alur: token (mobile) ATAU flag sesi web (cookie httpOnly) → validasi via
 * GET /me → nama + role server. Tidak ada jalan pintas: preview role DEV tidak
 * menyetel login.
 */
export class SessionManager {
  static async restore(): Promise<SessionProfile | null> {
    if (!TokenStorage.getToken() && !TokenStorage.isWebMode()) return null;
    try {
      await ensureCsrf();
      const profile = await AuthService.profile();
      if (!profile) TokenStorage.clearToken();
      return profile;
    } catch {
      TokenStorage.clearToken();
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return TokenStorage.getToken() !== null || TokenStorage.isWebMode();
  }

  static async logout(): Promise<void> {
    await AuthService.logout();
  }
}
