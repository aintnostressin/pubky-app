import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_STATUS_MISMATCH_TOLERANCE_MS } from '@/config/sync-status';
import type { Pubky } from '@/models/models.types';
import { useSyncStatusStore } from './syncStatus.store';
import { SyncStatus, type SyncStatusState } from './syncStatus.types';

const testUserPubky = 'qr3xqyz3e5cyf9npgxc5zfp15ehhcis6gqsxob4une7bwwazekry' as Pubky;

const createSyncState = (overrides: Partial<SyncStatusState> = {}): SyncStatusState => ({
  userPubky: testUserPubky,
  homeserverCursor: 100,
  nexusCursor: 100,
  mismatchSince: null,
  lastCheckedAt: 1_700_000_000_000,
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
