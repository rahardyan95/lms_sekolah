import http from 'k6/http';
import { check, sleep } from 'k6';

// Probe konkurensi wajar (server sekolah kecil: puluhan rps, bukan ratusan).
// Threshold sama: P95 200 ≤500ms.
export const options = {
  stages: [
    { duration: '20s', target: 10 },
    { duration: '40s', target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{status:200}': ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

const BASE = __ENV.K6_BASE_URL || 'http://localhost:8000/api/v1';
const PASS = __ENV.K6_DEMO_PASSWORD || 'password123';

export function setup() {
  const res = http.post(
    `${BASE}/login`,
    JSON.stringify({ identifier: 'operator@sekolah.sch.id', password: PASS }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) throw new Error(`setup login gagal: ${res.status}`);
  return { token: res.json('data.token') };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };
  const reads = ['me', 'cbt/exams', 'academic/schedules', 'cms/posts', 'library/books'];
  const ep = reads[Math.floor(Math.random() * reads.length)];
  const res = http.get(`${BASE}/${ep}`, { headers });
  check(res, { ok: (r) => [200, 403, 429].includes(r.status) });
  sleep(0.5);
}
