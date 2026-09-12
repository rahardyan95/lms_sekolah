/**
 * OOP wrapper penyimpanan token SPA.
 * Satu-satunya tempat yang boleh menyentuh sessionStorage untuk auth.
 * Migrasi ke httpOnly cookie kelak cukup ganti implementasi kelas ini
 * (consumer: AuthService, ApiClient tidak berubah).
 */
export class TokenStorage {
  private static readonly TOKEN_KEY = 'lms_token';

  private static readonly API_FLAG_KEY = 'lms_api';

  /** Penanda sesi web-cookie (token di httpOnly, bukan storage). */
  private static readonly WEB_KEY = 'lms_web_mode';

  static getToken(): string | null {
    try {
      return sessionStorage.getItem(TokenStorage.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static setToken(token: string): void {
    try {
      sessionStorage.setItem(TokenStorage.TOKEN_KEY, token);
      sessionStorage.setItem(TokenStorage.API_FLAG_KEY, '1');
    } catch {
      /* storage penuh/diblokir: abaikan, sesi jadi memory-only */
    }
  }

  static clearToken(): void {
    try {
      sessionStorage.removeItem(TokenStorage.TOKEN_KEY);
      sessionStorage.removeItem(TokenStorage.WEB_KEY);
      // Penanda API juga dibersihkan: sisa flag offline tidak boleh menutupi sesi berikutnya.
      sessionStorage.removeItem(TokenStorage.API_FLAG_KEY);
    } catch {
      /* abaikan */
    }
  }

  /** Sesi web hibrida: token di cookie httpOnly — storage hanya menyimpan mode. */
  static setWebSession(): void {
    try {
      sessionStorage.removeItem(TokenStorage.TOKEN_KEY);
      sessionStorage.setItem(TokenStorage.WEB_KEY, '1');
      sessionStorage.setItem(TokenStorage.API_FLAG_KEY, '1');
    } catch {
      /* abaikan */
    }
  }

  static isWebMode(): boolean {
    try {
      return sessionStorage.getItem(TokenStorage.WEB_KEY) === '1';
    } catch {
      return false;
    }
  }

  /** Ada sesi (Bearer mobile ATAU cookie web) — gate pemakaian API server. */
  static hasSession(): boolean {
    return TokenStorage.getToken() !== null || TokenStorage.isWebMode();
  }

  static markApiOffline(): void {
    try {
      sessionStorage.setItem(TokenStorage.API_FLAG_KEY, '0');
    } catch {
      /* abaikan */
    }
  }

  static isApiOnline(): boolean {
    try {
      return sessionStorage.getItem(TokenStorage.API_FLAG_KEY) !== '0';
    } catch {
      return true;
    }
  }
}
