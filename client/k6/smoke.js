import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke: 1 login + sapuan endpoint inti (matriks 8 role dicakup DemoAccountTest;
// login massal cepat shuffle kena throttle:auth 10/15mnt by design).
export const options = { vus: 1, iterations: 1 };

const BASE = __ENV.K6_BASE_URL || 'http://localhost:8000/api/v1';
// /up ada di root API host, bukan di prefix /api/v1 — turunkan satu level.
const UP_URL = __ENV.K6_UP_URL || BASE.replace(/\/api\/v1\/?$/, '') + '/up';
const PASS = __ENV.K6_DEMO_PASSWORD || 'password123';

export default function () {
  const login = http.post(
    `${BASE}/login`,
    JSON.stringify({ identifier: 'superadmin@sekolah.sch.id', password: PASS }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login 200': (r) => r.status === 200 });
  if (login.status !== 200) return;

  const headers = { Authorization: `Bearer ${login.json('data.token')}` };
  const endpoints = [
    'me', 'students?per_page=5', 'cbt/exams', 'finance/items',
    'library/books', 'academic/schedules', 'academic/announcements',
    'spmb/applications', 'broadcasts', 'settings', 'lms/subjects',
  ];
  for (const ep of endpoints) {
    const res = http.get(`${BASE}/${ep}`, { headers });
    check(res, { [`GET ${ep}`]: (r) => [200, 403].includes(r.status) });
    sleep(0.1);
  }

  const up = http.get(UP_URL);
  check(up, { '/up 200': (r) => r.status === 200 });
}
