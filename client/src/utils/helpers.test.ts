import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { formatRupiah, generateSvgQrMatrix, initialsAvatar, maskSensitive, terbilang } from './helpers';

describe('helpers', () => {
  it('formatRupiah memakai format Indonesia tanpa desimal', () => {
    expect(formatRupiah(1500000)).toContain('1.500.000');
    expect(formatRupiah(0)).toContain('0');
  });

  it('terbilang mengubah nominal menjadi kata', () => {
    expect(terbilang(150000).toLowerCase()).toContain('seratus lima puluh ribu');
  });

  it('maskSensitive menyembunyikan bagian tengah sesuai tipe', () => {
    expect(maskSensitive('3271234567890001', 'nik')).toBe('327123******0001');
    expect(maskSensitive('081234567890', 'phone')).toBe('0812****890');
    expect(maskSensitive('0071829384', 'nisn')).toBe('0071***384');
    expect(maskSensitive('rahasia', 'password')).toBe('••••••••');
    expect(maskSensitive('', 'nik')).toBe('');
  });

  it('initialsAvatar menghasilkan data-URI SVG offline dengan inisial', () => {
    const uri = initialsAvatar('Budi Santoso');
    expect(uri.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(uri)).toContain('BS');
  });

  it('initialsAvatar tetap aman untuk nama kosong', () => {
    expect(initialsAvatar('   ')).toContain('data:image/svg+xml');
  });

  it('generateSvgQrMatrix menggambar QR asli, bukan pola pseudo-acak', async () => {
    const payload = JSON.stringify({ payload: 'KTS1-abc', signature: 'sig-123' });
    const svg = await generateSvgQrMatrix(payload, 140, '#0f172a');

    // Modul gelap yang digambar = jumlah bit gelap matriks QR payload ini.
    const expectedDark = QRCode.create(payload, { errorCorrectionLevel: 'M' })
      .modules.data.filter(Boolean).length;
    const drawnDark = [...(svg.split('stroke=')[1] ?? '').matchAll(/h(\d+)/g)]
      .reduce((total, run) => total + Number(run[1]), 0);

    expect(svg.startsWith('<svg')).toBe(true);
    expect(drawnDark).toBe(expectedDark);
  });

  it('generateSvgQrMatrix memilih versi QR sesuai panjang data', async () => {
    const short = await generateSvgQrMatrix('NISN:0071829384', 180);
    const long = await generateSvgQrMatrix(`NISN:0071829384;${'X'.repeat(400)}`, 180);

    // Generator pseudo-acak lama selalu memasang grid 21x21.
    expect(Number(/viewBox="0 0 (\d+)/.exec(short)?.[1])).toBe(21);
    expect(Number(/viewBox="0 0 (\d+)/.exec(long)?.[1])).toBeGreaterThan(21);
  });
});
