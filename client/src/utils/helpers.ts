import { AuditLog } from '../types';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatTime(timeString: string): string {
  return timeString.length === 5 ? `${timeString} WIB` : timeString;
}

export function maskSensitive(
  value: string,
  type: 'nik' | 'phone' | 'password' | 'nisn'
): string {
  if (!value) return '';
  if (type === 'password') {
    return '••••••••';
  }
  if (type === 'nik') {
    // Show first 6 and last 4, mask middle: 317101******0002
    if (value.length >= 12) {
      return `${value.slice(0, 6)}******${value.slice(-4)}`;
    }
    return '**************';
  }
  if (type === 'phone') {
    // Show first 4 and last 3: 0812****789
    if (value.length >= 8) {
      return `${value.slice(0, 4)}****${value.slice(-3)}`;
    }
    return '0812********';
  }
  if (type === 'nisn') {
    // Show first 4 and last 3: 0071***384
    if (value.length >= 7) {
      return `${value.slice(0, 4)}***${value.slice(-3)}`;
    }
    return value;
  }
  return value;
}

// Convert numbers to Indonesian words for official school receipts (Kwitansi)
export function terbilang(nominal: number): string {
  const bilangan = [
    '',
    'Satu',
    'Dua',
    'Tiga',
    'Empat',
    'Lima',
    'Enam',
    'Tujuh',
    'Delapan',
    'Sembilan',
    'Sepuluh',
    'Sebelas',
  ];

  function toWords(n: number): string {
    if (n < 12) {
      return bilangan[n];
    } else if (n < 20) {
      return `${toWords(n - 10)} Belas`;
    } else if (n < 100) {
      return `${toWords(Math.floor(n / 10))} Puluh ${toWords(n % 10)}`.trim();
    } else if (n < 200) {
      return `Seratus ${toWords(n - 100)}`.trim();
    } else if (n < 1000) {
      return `${toWords(Math.floor(n / 100))} Ratus ${toWords(n % 100)}`.trim();
    } else if (n < 2000) {
      return `Seribu ${toWords(n - 1000)}`.trim();
    } else if (n < 1000000) {
      return `${toWords(Math.floor(n / 1000))} Ribu ${toWords(n % 1000)}`.trim();
    } else if (n < 1000000000) {
      return `${toWords(Math.floor(n / 1000000))} Juta ${toWords(n % 1000000)}`.trim();
    } else if (n < 1000000000000) {
      return `${toWords(Math.floor(n / 1000000000))} Miliar ${toWords(n % 1000000000)}`.trim();
    }
    return '';
  }

  const result = toWords(Math.floor(nominal)).trim();
  return result ? `${result} Rupiah` : 'Nol Rupiah';
}

// Deterministic Vector SVG QR Code generator (High visual precision with standard 3 finder patterns)
export function generateSvgQrMatrix(content: string, size = 180, foreground = '#0f172a'): string {
  const gridSize = 21;
  const cellSize = size / gridSize;
  
  // Deterministic pseudo-random seed from string
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }

  const matrix: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  // Helper: Draw Finder Pattern at (row, col)
  function drawFinderPattern(r: number, c: number) {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const isOuter = i === 0 || i === 6 || j === 0 || j === 6;
        const isInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        matrix[r + i][c + j] = isOuter || isInner;
      }
    }
  }

  // Draw 3 corner finder patterns
  drawFinderPattern(0, 0);
  drawFinderPattern(0, gridSize - 7);
  drawFinderPattern(gridSize - 7, 0);

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Populate data cells deterministically
  let currentHash = Math.abs(hash);
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Don't overwrite finder patterns
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= gridSize - 8;
      const inBottomLeft = r >= gridSize - 8 && c < 8;
      if (inTopLeft || inTopRight || inBottomLeft) continue;

      currentHash = (currentHash * 9301 + 49297) % 233280;
      matrix[r][c] = currentHash % 2 === 0;
    }
  }

  // Build SVG rects
  let rects = '';
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="${foreground}" rx="1"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="w-full h-full">${rects}</svg>`;
}

// In-memory Audit Log Store for Security Analyst view
let auditLogList: AuditLog[] = [
  {
    id: 'LOG-001',
    timestamp: '2026-09-08 07:12:05',
    user: 'Super Admin',
    role: 'super_admin',
    action: 'SYSTEM_STARTUP',
    details: 'Inisialisasi modul SIAKAD & LMS Terpadu v1.1',
    ipAddress: '192.168.1.10',
  },
  {
    id: 'LOG-002',
    timestamp: '2026-09-08 07:15:20',
    user: 'Admin TU (Dra. Siti Aminah)',
    role: 'admin_tu',
    action: 'AUTH_LOGIN_SUCCESS',
    details: 'Login via Email & Password terverifikasi',
    ipAddress: '192.168.1.25',
  },
  {
    id: 'LOG-003',
    timestamp: '2026-09-08 07:18:44',
    user: 'Operator (Rizky Ramadhan)',
    role: 'operator',
    action: 'QR_SCANNER_ACTIVATE',
    details: 'Kamera pemindai presensi QR diaktifkan di Gerbang Utama',
    ipAddress: '192.168.1.104',
  },
];

export function getAuditLogs(): AuditLog[] {
  return [...auditLogList];
}

export function addAuditLog(action: string, details: string, user = 'Current User', role = 'active_role'): void {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  
  const newLog: AuditLog = {
    id: `LOG-${pad(auditLogList.length + 1)}`,
    timestamp,
    user,
    role,
    action,
    details,
    ipAddress: '192.168.1.42',
  };
  auditLogList = [newLog, ...auditLogList.slice(0, 49)];
}
