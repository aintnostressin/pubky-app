import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_STATUS_FAILED_CHECK_THRESHOLD, SYNC_STATUS_MISMATCH_TOLERANCE_MS } from '@/config/sync-status';
import type { Pubky } from '@/models/models.types';
import { useSyncStatusStore } from './syncStatus.store';
import { SyncStatus, type SyncStatusState } from './syncStatus.types';

const testUserPubky = 'qr3xqyz3e5cyf9npgxc5zfp15ehhcis6gqsxob4une7bwwazekry' as Pubky;

const createSyncState = (overrides: Partial<SyncStatusState> = {}): SyncStatusState => ({
  userPubky: testUserPubky,
  homeserverCursor: 100,
  nexusCursor: 100,
  mismatchSince: null,
  mismatchPeakGap: null,
  pendingWriteSince: null,
  lastCheckedAt: 1_700_000_000_000,
  consecutiveFailures: 0,
  lastFailureAt: null,
  ...overrides,
});

describe('SyncStatusStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useSyncStatusStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have all values null initially', () => {
      const state = useSyncStatusStore.getState();

      expect(state.userPubky).toBeNull();
      expect(state.homeserverCursor).toBeNull();
      expect(state.nexusCursor).toBeNull();
      expect(state.mismatchSince).toBeNull();
      expect(state.lastCheckedAt).toBeNull();
    });

    it('should derive UNKNOWN before the first completed comparison', () => {
      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.UNKNOWN);
    });
  });

  describe('setSyncState', () => {
    it('should store the full cursor snapshot', () => {
      const snapshot = createSyncState({ homeserverCursor: 250, lastCheckedAt: 1_700_000_001_000 });

      useSyncStatusStore.getState().setSyncState(snapshot);

      const state = useSyncStatusStore.getState();
      expect(state.userPubky).toBe(testUserPubky);
      expect(state.homeserverCursor).toBe(250);
      expect(state.nexusCursor).toBe(100);
      expect(state.mismatchSince).toBeNull();
      expect(state.lastCheckedAt).toBe(1_700_000_001_000);
    });
  });

  describe('selectSyncStatus', () => {
    it('should derive SYNCED when the nexus cursor is ahead of the homeserver cursor', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState({ homeserverCursor: 100, nexusCursor: 120 }));

      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.SYNCED);
    });

    it('should derive SYNCED when the cursors are equal', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState({ homeserverCursor: 100, nexusCursor: 100 }));

      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.SYNCED);
    });

    it('should derive UNKNOWN when a cursor is missing', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState({ homeserverCursor: null, nexusCursor: 10 }));

      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.UNKNOWN);
    });

    it('should derive OUT_OF_SYNC when nexus is behind with a recent mismatch', () => {
      const now = Date.now();

      useSyncStatusStore
        .getState()
        .setSyncState(createSyncState({ homeserverCursor: 100, nexusCursor: 50, mismatchSince: now - 1_000 }));

      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.OUT_OF_SYNC);
    });

    describe('stale boundary', () => {
      const FIXED_NOW = 1_700_000_000_000;

      beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should stay OUT_OF_SYNC at exactly the mismatch tolerance', () => {
        useSyncStatusStore.getState().setSyncState(
          createSyncState({
            homeserverCursor: 100,
            nexusCursor: 50,
            mismatchSince: FIXED_NOW - SYNC_STATUS_MISMATCH_TOLERANCE_MS,
          }),
        );

        expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.OUT_OF_SYNC);
      });

      it('should derive OUT_OF_SYNC_STALE once the mismatch exceeds the tolerance', () => {
        useSyncStatusStore.getState().setSyncState(
          createSyncState({
            homeserverCursor: 100,
            nexusCursor: 50,
            mismatchSince: FIXED_NOW - SYNC_STATUS_MISMATCH_TOLERANCE_MS - 1,
          }),
        );

        expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.OUT_OF_SYNC_STALE);
      });
    });
  });

  describe('recordCheckFailure', () => {
    it('should count consecutive failures without touching the cursors', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState());

      useSyncStatusStore.getState().recordCheckFailure(1_700_000_005_000);

      const state = useSyncStatusStore.getState();
      expect(state.consecutiveFailures).toBe(1);
      expect(state.lastFailureAt).toBe(1_700_000_005_000);
      expect(state.homeserverCursor).toBe(100);
      expect(state.nexusCursor).toBe(100);
    });

    it('should derive CHECK_FAILING once the failure threshold is reached', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState());

      for (let attempt = 0; attempt < SYNC_STATUS_FAILED_CHECK_THRESHOLD; attempt++) {
        useSyncStatusStore.getState().recordCheckFailure(Date.now());
      }

      // Cursors still say "synced": an unreachable Nexus must not read as a
      // healthy one just because the last successful check was in sync.
      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.CHECK_FAILING);
    });

    it('should stay on the cursor-derived status below the threshold', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState());

      useSyncStatusStore.getState().recordCheckFailure(Date.now());

      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.SYNCED);
    });

    it('should clear the failure streak once a check completes again', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState());
      useSyncStatusStore.getState().recordCheckFailure(Date.now());
      useSyncStatusStore.getState().recordCheckFailure(Date.now());

      useSyncStatusStore.getState().setSyncState(createSyncState());

      expect(useSyncStatusStore.getState().consecutiveFailures).toBe(0);
      expect(useSyncStatusStore.getState().lastFailureAt).toBeNull();
      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.SYNCED);
    });
  });

  describe('markPendingWrite', () => {
    it('should report OUT_OF_SYNC straight after a write, before any poll', () => {
      // Cursors still say synced: the write has not been polled for yet.
      useSyncStatusStore.getState().setSyncState(createSyncState());

      useSyncStatusStore.getState().markPendingWrite(Date.now());

      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.OUT_OF_SYNC);
    });

    it('should age an unconfirmed write into OUT_OF_SYNC_STALE like a cursor mismatch', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState());

      useSyncStatusStore.getState().markPendingWrite(Date.now() - SYNC_STATUS_MISMATCH_TOLERANCE_MS - 1_000);

      expect(useSyncStatusStore.getState().selectSyncStatus()).toBe(SyncStatus.OUT_OF_SYNC_STALE);
    });

    it('should be cleared by a reset', () => {
      useSyncStatusStore.getState().markPendingWrite(Date.now());

      useSyncStatusStore.getState().reset();

      expect(useSyncStatusStore.getState().pendingWriteSince).toBeNull();
    });
  });

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      useSyncStatusStore.getState().setSyncState(createSyncState({ mismatchSince: 123 }));

      useSyncStatusStore.getState().reset();

      const state = useSyncStatusStore.getState();
      expect(state.userPubky).toBeNull();
      expect(state.homeserverCursor).toBeNull();
      expect(state.nexusCursor).toBeNull();
      expect(state.mismatchSince).toBeNull();
      expect(state.lastCheckedAt).toBeNull();
      expect(state.selectSyncStatus()).toBe(SyncStatus.UNKNOWN);
    });
  });
});
