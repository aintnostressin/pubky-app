import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_STATUS_FAILED_CHECK_THRESHOLD } from '@/config/sync-status';
import { SyncStatusController } from '@/controllers/sync-status/sync-status';
import type { PollingServiceConfig } from '@/coordinators/base/coordinators.types';
import { SyncStatusCoordinator } from '@/coordinators/sync-status/sync-status';
import type { SyncStatusCoordinatorConfig } from '@/coordinators/sync-status/sync-status.types';
import { notifyHomeserverWrite } from '@/libs/homeserver-write/homeserver-write';
import { useAuthStore } from '@/stores/auth/auth.store';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';
import { SyncStatus } from '@/stores/syncStatus/syncStatus.types';
import { mockSession } from '@/test-utils/pubky';

vi.mock('@/controllers/sync-status/sync-status', () => ({
  SyncStatusController: {
    fetchSyncStatus: vi.fn(),
  },
}));

const mockFetchSyncStatus = vi.mocked(SyncStatusController.fetchSyncStatus);

/**
 * Type helper for coordinator config that includes base polling config properties
 * (same approach as notifications.test.ts)
 */
type CoordinatorConfigWithBase = SyncStatusCoordinatorConfig & PollingServiceConfig;

/**
 * Sets up an authenticated user with a profile (required for polling)
 */
function setupAuthenticatedTest(userId = 'user123') {
  mockFetchSyncStatus.mockResolvedValue(undefined);
  useAuthStore.getState().init({
    session: mockSession(),
    currentUserPubky: userId,
    hasProfile: true,
  });
  const coordinator = SyncStatusCoordinator.getInstance();
  return { coordinator };
}

/**
 * Flushes pending async promises
 * Useful for pollOnStart tests
 */
async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('SyncStatusCoordinator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset coordinator singleton, auth store and sync status store before each test
    SyncStatusCoordinator.resetInstance();
    useAuthStore.getState().reset();
    useSyncStatusStore.getState().reset();
    mockFetchSyncStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Singleton Behavior', () => {
    it('returns the same instance on multiple getInstance() calls', () => {
      const instance1 = SyncStatusCoordinator.getInstance();
      const instance2 = SyncStatusCoordinator.getInstance();
      const instance3 = SyncStatusCoordinator.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
      expect(instance1).toBe(instance3);
    });

    it('creates a new instance after resetInstance()', () => {
      const instance1 = SyncStatusCoordinator.getInstance();

      SyncStatusCoordinator.resetInstance();

      const instance2 = SyncStatusCoordinator.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Polling', () => {
    it('polls every configured interval while authenticated on an allowed route', () => {
      const { coordinator } = setupAuthenticatedTest('user123');
      coordinator.configure({ pollOnStart: false, intervalMs: 1_000 } as Partial<CoordinatorConfigWithBase>);
      coordinator.start();

      vi.advanceTimersByTime(3_000);

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(3);
      expect(mockFetchSyncStatus).toHaveBeenCalledWith({ userPubky: 'user123' });
    });

    it('does not poll when the user is not authenticated', () => {
      const coordinator = SyncStatusCoordinator.getInstance();
      coordinator.configure({ pollOnStart: false, intervalMs: 1_000 } as Partial<CoordinatorConfigWithBase>);
      coordinator.start();

      vi.advanceTimersByTime(3_000);

      expect(mockFetchSyncStatus).not.toHaveBeenCalled();
    });

    it('does not poll on disabled routes', async () => {
      const { coordinator } = setupAuthenticatedTest('user123');
      coordinator.configure({ pollOnStart: false, intervalMs: 1_000 } as Partial<CoordinatorConfigWithBase>);
      await coordinator.setRoute('/onboarding');
      coordinator.start();

      vi.advanceTimersByTime(3_000);

      expect(mockFetchSyncStatus).not.toHaveBeenCalled();
    });

    it('resumes polling when navigating back to an allowed route', async () => {
      const { coordinator } = setupAuthenticatedTest('user123');
      coordinator.configure({ pollOnStart: false, intervalMs: 1_000 } as Partial<CoordinatorConfigWithBase>);
      await coordinator.setRoute('/onboarding');
      await coordinator.setRoute('/home');
      coordinator.start();

      vi.advanceTimersByTime(1_000);

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(1);
    });

    it('stops polling after stop()', () => {
      const { coordinator } = setupAuthenticatedTest('user123');
      coordinator.configure({ pollOnStart: false, intervalMs: 1_000 } as Partial<CoordinatorConfigWithBase>);
      coordinator.start();

      vi.advanceTimersByTime(2_000);
      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(2);

      coordinator.stop();
      vi.advanceTimersByTime(5_000);

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(2); // No additional calls
    });

    it('polls immediately when pollOnStart is enabled', async () => {
      const { coordinator } = setupAuthenticatedTest('user123');
      coordinator.configure({ pollOnStart: true, intervalMs: 10_000 } as Partial<CoordinatorConfigWithBase>);
      coordinator.start();
      await flushPromises();

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(1);
    });

    it('keeps the previous store state when a poll fails', async () => {
      const { coordinator } = setupAuthenticatedTest('user123');
      mockFetchSyncStatus.mockRejectedValue(new Error('nexus down'));
      coordinator.configure({ pollOnStart: true, intervalMs: 10_000 } as Partial<CoordinatorConfigWithBase>);
      coordinator.start();
      await flushPromises();

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(1);
      expect(useSyncStatusStore.getState().userPubky).toBeNull();
    });
  });

  describe('Homeserver write triggers', () => {
    const IDLE_INTERVAL_MS = 600_000;

    /** Starts a coordinator that only polls when a homeserver write triggers it */
    function setupIdleCoordinator(userId = 'user123') {
      const { coordinator } = setupAuthenticatedTest(userId);
      coordinator.configure({ pollOnStart: false, intervalMs: IDLE_INTERVAL_MS } as Partial<CoordinatorConfigWithBase>);
      coordinator.start();
      return { coordinator };
    }

    /** Makes the next poll report the user as fully indexed by Nexus */
    function resolvePollAsSynced(userPubky = 'user123') {
      mockFetchSyncStatus.mockImplementation(async () => {
        useSyncStatusStore.getState().setSyncState({
          userPubky,
          homeserverCursor: 5,
          nexusCursor: 5,
          mismatchSince: null,
          mismatchPeakGap: null,
          pendingWriteSince: null,
          lastCheckedAt: Date.now(),
          consecutiveFailures: 0,
          lastFailureAt: null,
        });
      });
    }

    it('polls immediately after a homeserver write', async () => {
      setupIdleCoordinator();

      notifyHomeserverWrite();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(1);
      expect(mockFetchSyncStatus).toHaveBeenCalledWith({ userPubky: 'user123' });
    });

    it('keeps polling on the active interval while Nexus is behind', async () => {
      setupIdleCoordinator();

      notifyHomeserverWrite();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(2_000);

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(3);
    });

    it('stops the burst once Nexus catches up', async () => {
      setupIdleCoordinator();
      resolvePollAsSynced();

      notifyHomeserverWrite();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(1);
    });

    it('stops the burst when the active window expires while still behind', async () => {
      setupIdleCoordinator();

      notifyHomeserverWrite();
      await vi.advanceTimersByTimeAsync(61_000);
      const callsDuringWindow = mockFetchSyncStatus.mock.calls.length;

      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(callsDuringWindow);
    });

    it('coalesces a burst of writes into a single poll chain', async () => {
      setupIdleCoordinator();

      notifyHomeserverWrite();
      notifyHomeserverWrite();
      notifyHomeserverWrite();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(1);
    });

    it('ignores writes when polling is not active', async () => {
      const coordinator = SyncStatusCoordinator.getInstance();
      coordinator.configure({ pollOnStart: false, intervalMs: IDLE_INTERVAL_MS } as Partial<CoordinatorConfigWithBase>);

      notifyHomeserverWrite();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(mockFetchSyncStatus).not.toHaveBeenCalled();
    });

    it('cancels a pending burst when the coordinator stops', async () => {
      const { coordinator } = setupIdleCoordinator();

      notifyHomeserverWrite();
      coordinator.stop();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(mockFetchSyncStatus).not.toHaveBeenCalled();
    });

    it('ignores writes after the coordinator is destroyed', async () => {
      setupIdleCoordinator();

      SyncStatusCoordinator.resetInstance();
      notifyHomeserverWrite();
      await vi.advanceTimersByTimeAsync(5_000);

      expect(mockFetchSyncStatus).not.toHaveBeenCalled();
    });
  });
  describe('failed checks', () => {
    it('records a failure in the store when a poll rejects', async () => {
      const { coordinator } = setupAuthenticatedTest();
      mockFetchSyncStatus.mockRejectedValue(new Error('nexus unreachable'));
      coordinator.configure({ pollOnStart: true, intervalMs: 30_000 } as Partial<CoordinatorConfigWithBase>);

      await coordinator.start();
      await flushPromises();

      expect(useSyncStatusStore.getState().consecutiveFailures).toBeGreaterThan(0);
    });

    it('reports CHECK_FAILING once consecutive polls keep failing', async () => {
      const { coordinator } = setupAuthenticatedTest();
      mockFetchSyncStatus.mockRejectedValue(new Error('nexus unreachable'));
      coordinator.configure({ pollOnStart: true, intervalMs: 30_000 } as Partial<CoordinatorConfigWithBase>);

      await coordinator.start();
      for (let attempt = 0; attempt < SYNC_STATUS_FAILED_CHECK_THRESHOLD; attempt++) {
        await vi.advanceTimersByTimeAsync(30_000);
      }

      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.CHECK_FAILING);
    });
  });

  describe('refreshNow', () => {
    it('runs a check immediately, outside the polling cadence', async () => {
      const { coordinator } = setupAuthenticatedTest();
      coordinator.configure({ pollOnStart: false, intervalMs: 30_000 } as Partial<CoordinatorConfigWithBase>);
      await coordinator.start();
      mockFetchSyncStatus.mockClear();

      await coordinator.refreshNow();

      expect(mockFetchSyncStatus).toHaveBeenCalledTimes(1);
    });

    it('does nothing when polling is not allowed', async () => {
      const coordinator = SyncStatusCoordinator.getInstance();
      useAuthStore.getState().reset();

      await coordinator.refreshNow();

      expect(mockFetchSyncStatus).not.toHaveBeenCalled();
    });
  });
});
