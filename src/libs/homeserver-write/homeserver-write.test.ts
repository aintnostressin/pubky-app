import { describe, expect, it, vi } from 'vitest';
import { notifyHomeserverWrite, onHomeserverWrite } from './homeserver-write';

describe('homeserver-write notifier', () => {
  it('calls every subscribed listener on notify', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = onHomeserverWrite(first);
    const unsubscribeSecond = onHomeserverWrite(second);

    notifyHomeserverWrite();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('stops calling a listener after it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = onHomeserverWrite(listener);

    unsubscribe();
    notifyHomeserverWrite();

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps notifying the remaining listeners when one throws', () => {
    const throwing = vi.fn(() => {
      throw new Error('listener boom');
    });
    const healthy = vi.fn();
    const unsubscribeThrowing = onHomeserverWrite(throwing);
    const unsubscribeHealthy = onHomeserverWrite(healthy);

    expect(() => notifyHomeserverWrite()).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);

    unsubscribeThrowing();
    unsubscribeHealthy();
  });
});
