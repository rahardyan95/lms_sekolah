import { api } from '../lib/ApiClient';
import { API_BASE } from './OpsApiService';

export interface ServerWave {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  quota: number;
  filled: number;
  fee: number;
  is_open: boolean;
}

export interface ServerApplication {
  id: string;
  registration_number: string;
  wave_id: string;
  name: string;
  nisn: string;
  gender: 'L' | 'P';
  birth_date: string | null;
  parent_name: string;
  chosen_major: string | null;
  status: 'draft' | 'verified' | 'accepted' | 'rejected';
  notes: string | null;
  created_at?: string;
}

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

/** OOP client SPMB. Pendaftaran & gelombang publik; review butuh token panitia. */
export class SpmbApiService {
  static async waves(): Promise<ServerWave[]> {
    const res = await api.get('/spmb/waves');
    return unwrap<ServerWave[]>(res);
  }

  static async submit(waveId: string, payload: Record<string, unknown>): Promise<ServerApplication> {
    const res = await api.post(`/spmb/waves/${waveId}/applications`, payload);
    return unwrap<ServerApplication>(res);
  }

  static async statusCheck(registrationNumber: string, birthDate: string): Promise<ServerApplication> {
    const res = await api.post('/spmb/status', {
      registration_number: registrationNumber,
      birth_date: birthDate,
    });
    return unwrap<ServerApplication>(res);
  }

  static async review(): Promise<ServerApplication[]> {
    const res = await api.get('/spmb/applications');
    const page = unwrap<{ data: ServerApplication[] } | ServerApplication[]>(res);
    return Array.isArray(page) ? page : page.data;
  }

  static async verify(id: string): Promise<ServerApplication> {
    const res = await api.post(`/spmb/applications/${id}/verify`);
    return unwrap<ServerApplication>(res);
  }

  static async decide(id: string, status: 'accepted' | 'rejected', notes?: string): Promise<ServerApplication> {
    const res = await api.post(`/spmb/applications/${id}/decide`, { status, notes });
    return unwrap<ServerApplication>(res);
  }

  static async convert(id: string): Promise<void> {
    await api.post(`/spmb/applications/${id}/convert`);
  }

  /**
   * Unggah berkas pendaftaran. Pendaftar tidak punya sesi — kredensial
   * (nomor pendaftaran + tanggal lahir) yang sama dengan cek status dipakai ulang.
   */
  static async uploadFile(
    applicationId: string,
    input: { registrationNumber: string; birthDate: string; kind: string; file: File },
  ): Promise<ServerSpmbFile> {
    const form = new FormData();
    form.append('registration_number', input.registrationNumber);
    form.append('birth_date', input.birthDate);
    form.append('kind', input.kind);
    form.append('file', input.file);
    const res = await api.post(`/spmb/applications/${applicationId}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap<ServerSpmbFile>(res);
  }

  /** URL unduh berkas (khusus panitia — endpoint memerlukan peran + policy). */
  static fileUrl(fileId: string): string {
    return `${API_BASE}/spmb/files/${fileId}/download`;
  }

  /** Bukti pendaftaran PDF (blob) — kredensial sama dengan cek status. */
  static async proofBlob(applicationId: string, registrationNumber: string, birthDate: string): Promise<Blob> {
    const res = await api.get(`/spmb/applications/${applicationId}/proof`, {
      params: { registration_number: registrationNumber, birth_date: birthDate },
      responseType: 'blob',
    });
    return new Blob([res.data], { type: 'application/pdf' });
  }
}

export interface ServerSpmbFile {
  id: string;
  application_id: string;
  kind: string;
  original_name: string;
  mime: string;
  size: number;
  created_at?: string;
}
