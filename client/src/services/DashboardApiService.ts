import { api } from '../lib/ApiClient';

export interface DashboardSummary {
  total_students: number;
  attendance_today: number;
  attendance_rate: number;
  active_cbt_exams: number;
}

/** OOP client ringkasan dashboard staf — angka nyata dari server. */
export class DashboardApiService {
  static async summary(): Promise<DashboardSummary> {
    const res = await api.get('/dashboard/summary');

    return res.data.data as DashboardSummary;
  }
}
