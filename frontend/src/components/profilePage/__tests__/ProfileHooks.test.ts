import { describe, it, expect } from 'vitest';
import { getApiUrl } from '../../../lib/api';
import { formatCurrency } from '../../../lib/format';

describe('Shared API and format utilities', () => {
  describe('formatCurrency', () => {
    it('formats 0 correctly', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    it('formats positive numbers correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,235'); // because of maximumFractionDigits: 0
    });

    it('formats large numbers with commas', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000');
    });
  });

  describe('getApiUrl', () => {
    it('returns path as is if VITE_API_BASE is not set', () => {
      import.meta.env.VITE_API_BASE = '';
      expect(getApiUrl('/api/test')).toBe('/api/test');
    });

    it('prepends VITE_API_BASE to path', () => {
      import.meta.env.VITE_API_BASE = 'http://localhost:8080';
      expect(getApiUrl('/api/test')).toBe('http://localhost:8080/api/test');
    });

    it('handles trailing slashes in VITE_API_BASE', () => {
      import.meta.env.VITE_API_BASE = 'http://localhost:8080/';
      expect(getApiUrl('/api/test')).toBe('http://localhost:8080/api/test');
    });

    it('handles paths without leading slashes', () => {
      import.meta.env.VITE_API_BASE = 'http://localhost:8080';
      expect(getApiUrl('api/test')).toBe('http://localhost:8080/api/test');
    });
  });
});
