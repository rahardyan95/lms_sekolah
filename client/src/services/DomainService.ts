import { api } from '../lib/ApiClient';
import type { AttendanceRecord, Student } from '../types';

export class StudentService {
  static async list(search = ''): Promise<Student[]> {
    const res = await api.get('/students', { params: { search, per_page: 25 } });
    return res.data.data as Student[];
  }
}

export class AttendanceService {
  static async scan(nisn: string, date: string): Promise<AttendanceRecord> {
    const res = await api.post('/attendance/scans', {
      nisn,
      date,
      idempotency_key: `${nisn}-${date}-${Date.now()}`,
    });
    return res.data.data as AttendanceRecord;
  }

  static async reports(from: string, to: string) {
    const res = await api.get('/attendance/reports', { params: { from, to } });
    return res.data.data;
  }
}
