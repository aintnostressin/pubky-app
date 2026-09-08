import { describe, expect, it } from 'vitest';
import { formatAge, formatDuration } from './SyncStatusIndicator.utils';

describe('formatAge', () => {
  it('collapses anything under five seconds into "just now"', () => {
    expect(formatAge(0)).toBe('just now');
    expect(formatAge(4_999)).toBe('just now');
  });

  it('formats seconds, minutes and hours', () => {
    expect(formatAge(12_000)).toBe('12s ago');
    expect(formatAge(59_999)).toBe('59s ago');
    expect(formatAge(3 * 60_000)).toBe('3m ago');
    expect(formatAge(2 * 60 * 60_000)).toBe('2h ago');
  });
});

describe('formatDuration', () => {
  it('formats a mismatch duration without the "ago" suffix', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(5 * 60_000)).toBe('5m');
    expect(formatDuration(3 * 60 * 60_000)).toBe('3h');
  });

  it('never reports a negative duration from a clock skew', () => {
    expect(formatDuration(-1_000)).toBe('0s');
  });
});
