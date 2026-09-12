import { api } from '../lib/ApiClient';

/** Basis URL API — dipakai untuk tautan berkas (PDF/QR) yang butuh cookie sesi. */
export const API_BASE = String(api.defaults.baseURL ?? '');

export interface ServerPost {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  tags: string[] | null;
  status?: string;
  published_at: string | null;
  created_at: string;
}

function unwrapPage<T>(res: { data: { data: { data?: T[] } | T[] } }): T[] {
  const page = res.data.data;
  return Array.isArray(page) ? page : page.data ?? [];
}

/** OOP client CMS publik + KTS + Broadcast + Settings. */
export class CmsApiService {
  static async posts(): Promise<ServerPost[]> {
    const res = await api.get('/cms/posts');
    return unwrapPage<ServerPost>(res);
  }

  /** Daftar SEMUA status untuk panel admin (filter status/kategori/cari). */
  static async adminPosts(params?: {
    status?: string;
    category?: string;
    search?: string;
  }): Promise<ServerPost[]> {
    const res = await api.get('/cms/admin/posts', { params });
    return unwrapPage<ServerPost>(res);
  }

  static async createPost(payload: CmsPostInput): Promise<ServerPost> {
    const res = await api.post('/cms/posts', payload);
    return res.data.data as ServerPost;
  }

  static async updatePost(id: string, payload: CmsPostInput): Promise<ServerPost> {
    const res = await api.put(`/cms/posts/${id}`, payload);
    return res.data.data as ServerPost;
  }

  static async deletePost(id: string): Promise<void> {
    await api.delete(`/cms/posts/${id}`);
  }
}

/** Payload tulis CMS — isi konten disanitasi di server, bukan di UI. */
export interface CmsPostInput {
  title: string;
  category?: string;
  excerpt?: string;
  content: string;
  image_url?: string;
  tags?: string[];
  status?: 'draft' | 'review' | 'published' | 'archived';
}

export class KtsApiService {
  static async issue(studentId: string): Promise<{ payload: string; signature: string; expires_at: string; token_id?: string }> {
    const res = await api.post(`/kts/students/${studentId}/issue`);
    return res.data.data as { payload: string; signature: string; expires_at: string; token_id?: string };
  }

  /** Daftar token QR siswa: `id` dipakai untuk mencabut (bukan jti). */
  static async tokens(studentId: string): Promise<ServerKtsToken[]> {
    const res = await api.get(`/kts/students/${studentId}/tokens`);
    return res.data.data as ServerKtsToken[];
  }

  static async verify(payload: string, signature: string): Promise<{ valid: boolean; nisn: string | null }> {
    const res = await api.post('/kts/verify', { payload, signature });
    return res.data.data as { valid: boolean; nisn: string | null };
  }

  /** Template aktif (version berversi, riwayat immutable). */
  static async template(): Promise<ServerKtsTemplate> {
    const res = await api.get('/kts/templates/active');
    return res.data.data as ServerKtsTemplate;
  }

  /** Simpan template: server menyimpan VERSI BARU, bukan menimpa baris lama. */
  static async saveTemplate(input: {
    colors?: Record<string, string>;
    visibility?: Record<string, boolean>;
    watermark?: string | null;
  }): Promise<ServerKtsTemplate> {
    const res = await api.put('/kts/templates', input);
    return res.data.data as ServerKtsTemplate;
  }

  static async revoke(tokenId: string): Promise<void> {
    await api.post(`/kts/tokens/${tokenId}/revoke`);
  }

  /** Unggah/ganti foto siswa (jpg/png maks 2 MB) untuk kartu PDF & pratinjau. */
  static async uploadPhoto(studentId: string, file: File): Promise<{ photo_path: string; photo_url: string | null }> {
    const form = new FormData();
    form.append('photo', file);

    const res = await api.post(`/kts/students/${studentId}/photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return res.data.data as { photo_path: string; photo_url: string | null };
  }

  /** URL kartu KTS (unduh PDF — cookie sesi ikut terkirim). */
  static cardUrl(studentId: string): string {
    return `${API_BASE}/kts/students/${studentId}/card`;
  }

  /** URL QR SVG (vektor) untuk modal presensi. */
  static qrUrl(studentId: string): string {
    return `${API_BASE}/kts/students/${studentId}/qr.svg`;
  }
}

export interface ServerKtsToken {
  id: string;
  jti: string;
  expires_at: string;
  revoked_at: string | null;
  valid: boolean;
}

export interface ServerKtsTemplate {
  id: string;
  colors: Record<string, string>;
  visibility: Record<string, boolean>;
  watermark: string | null;
  version: number;
  active: boolean;
}

export interface ServerBroadcast {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
  logs_count?: number;
  created_at: string;
}

export interface ServerBroadcastLog {
  id: string;
  recipient_name: string;
  recipient_phone?: string | null;
  status: string;
  provider_response: string | null;
  created_at: string;
}

export interface WaTestResult {
  provider?: string | null;
  ok?: boolean;
  status?: string | null;
  error?: string | null;
}

export class BroadcastApiService {
  static async send(
    title: string,
    body: string,
    audience: 'siswa' | 'orang_tua' | 'guru' | 'semua',
  ): Promise<{ total: number; sent: number; failed: number }> {
    const res = await api.post('/broadcasts', { title, body, audience });
    return res.data.data.delivery as { total: number; sent: number; failed: number };
  }

  static async list(): Promise<ServerBroadcast[]> {
    const res = await api.get('/broadcasts');
    return unwrapPage<ServerBroadcast>(res);
  }

  static async logs(id: string): Promise<ServerBroadcastLog[]> {
    const res = await api.get(`/broadcasts/${id}/logs`);
    return unwrapPage<ServerBroadcastLog>(res);
  }

  static async testMessage(phone: string): Promise<WaTestResult> {
    const res = await api.post('/whatsapp/test', { phone });
    return res.data.data as WaTestResult;
  }
}

export interface ServerNotificationLog {
  id: string;
  channel: string;
  recipient: string;
  template: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  provider_ref: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

/** Log pengiriman notifikasi (WA) + kirim ulang baris gagal (dead-letter view). */
export class NotificationApiService {
  static async list(status?: ServerNotificationLog['status']): Promise<ServerNotificationLog[]> {
    const res = await api.get('/notifications', { params: status ? { status } : {} });
    return unwrapPage<ServerNotificationLog>(res);
  }

  static async retry(id: string): Promise<ServerNotificationLog> {
    const res = await api.post(`/notifications/${id}/retry`);
    return res.data.data as ServerNotificationLog;
  }
}

export class SettingsApiService {
  static async get(): Promise<Record<string, string | null>> {
    const res = await api.get('/settings');
    return res.data.data as Record<string, string | null>;
  }

  static async set(key: string, value: string, version?: number): Promise<{ version: number }> {
    const res = await api.put(`/settings/${key}`, version !== undefined ? { value, version } : { value });
    const data = res.data.data as { version?: number };
    return { version: typeof data?.version === 'number' ? data.version : 0 };
  }
}
