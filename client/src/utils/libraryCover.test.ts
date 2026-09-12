import { describe, expect, it } from 'vitest';
import { libraryCover } from './helpers';

describe('libraryCover', () => {
  it('menghasilkan data-URI SVG tanpa hotlink gambar eksternal', () => {
    const uri = libraryCover('Clean Architecture', 'book-1');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    expect(uri).not.toContain('unsplash');
    expect(uri).not.toContain('picsum');
    expect(uri).not.toContain('https://images');
  });

  it('deterministik untuk judul + seed yang sama', () => {
    expect(libraryCover('Matematika', 'a')).toBe(libraryCover('Matematika', 'a'));
  });

  it('berbeda untuk judul berbeda', () => {
    expect(libraryCover('Fisika', 'a')).not.toBe(libraryCover('Kimia', 'a'));
  });
});
