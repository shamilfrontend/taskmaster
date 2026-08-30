import { describe, expect, it } from 'vitest';
import { safeAuthNext } from './auth.ts';

describe('safeAuthNext', () => {
  it('keeps in-app paths', () => {
    expect(safeAuthNext('/')).toBe('/');
    expect(safeAuthNext('/invite/abc')).toBe('/invite/abc');
    expect(safeAuthNext('/projects/1')).toBe('/projects/1');
  });

  it('rejects API and protocol-relative paths', () => {
    expect(safeAuthNext('/api/auth/yandex')).toBe('/');
    expect(safeAuthNext('/api/auth/yandex?next=/')).toBe('/');
    expect(safeAuthNext('//evil.example')).toBe('/');
    expect(safeAuthNext('https://evil.example')).toBe('/');
    expect(safeAuthNext(undefined)).toBe('/');
  });
});
