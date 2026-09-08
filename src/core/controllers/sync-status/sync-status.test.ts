import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncStatusApplication } from '@/application/sync-status/sync-status';
import { SyncStatusController } from '@/controllers/sync-status/sync-status';
import type { Pubky } from '@/models/models.types';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';

vi.mock('@/application/sync-status/sync-status', () => ({
  SyncStatusApplication: {
    fetchCursorSnapshot: vi.fn(),
  },
}));

const mockFetchCursorSnapshot = vi.mocked(SyncStatusApplication.fetchCursorSnapshot);

const userAPubky = 'qr3xqyz3e5cyf9npgxc5zfp15ehhcis6gqsxob4une7bwwazekry' as Pubky;
const userBPubky = 'qr3xqyz3e5cyf9npgxc5zfp15ehhcis6gqsxob4une7bwwazekra' as Pubky;

const NOW = 1_700_000_000_000;

describe('SyncStatusController', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    mockFetchCursorSnapshot.mockReset();
    useSyncStatusStore.getState().reset();
  });

  describe('fetchSyncStatus', () => {
    it('should store the cursor snapshot with a fresh lastCheckedAt', async () => {
      mockFetchCursorSnapshot.mockResolvedValue({ homeserverCursor: 100, nexusCursor: 100 });

      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });

      const state = useSyncStatusStore.getState();
      expect(state.userPubky).toBe(userAPubky);
      expect(state.homeserverCursor).toBe(100);
      expect(state.nexusCursor).toBe(100);
      expect(state.lastCheckedAt).toBe(NOW);
      expect(state.mismatchSince).toBeNull();
    });

    it('should record the mismatch timestamp when nexus is behind', async () => {
      mockFetchCursorSnapshot.mockResolvedValue({ homeserverCursor: 100, nexusCursor: 50 });

      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });

      expect(useSyncStatusStore.getState().mismatchSince).toBe(NOW);
    });

    it('should keep the original mismatch timestamp while still behind for the same user', async () => {
      mockFetchCursorSnapshot.mockResolvedValue({ homeserverCursor: 100, nexusCursor: 50 });

      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });
      vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });

      const state = useSyncStatusStore.getState();
      expect(mockFetchCursorSnapshot).toHaveBeenCalledTimes(2);
      expect(state.mismatchSince).toBe(NOW);
      expect(state.lastCheckedAt).toBe(NOW + 60_000);
    });

    it('should clear the mismatch timestamp when nexus catches up', async () => {
      mockFetchCursorSnapshot
        .mockResolvedValueOnce({ homeserverCursor: 100, nexusCursor: 50 })
        .mockResolvedValueOnce({ homeserverCursor: 100, nexusCursor: 100 });

      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });
      expect(useSyncStatusStore.getState().mismatchSince).toBe(NOW);

      vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });

      expect(useSyncStatusStore.getState().mismatchSince).toBeNull();
    });

    it('should start a fresh mismatch window when the signed-in user changes', async () => {
      mockFetchCursorSnapshot.mockResolvedValue({ homeserverCursor: 100, nexusCursor: 50 });

      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });
      expect(useSyncStatusStore.getState().mismatchSince).toBe(NOW);

      vi.mocked(Date.now).mockReturnValue(NOW + 60_000);
      await SyncStatusController.fetchSyncStatus({ userPubky: userBPubky });

      const state = useSyncStatusStore.getState();
      expect(state.userPubky).toBe(userBPubky);
      expect(state.mismatchSince).toBe(NOW + 60_000);
    });

    it('should propagate application failures so the caller keeps the previous store state', async () => {
      const error = new Error('nexus down');
      mockFetchCursorSnapshot.mockRejectedValue(error);

      await expect(SyncStatusController.fetchSyncStatus({ userPubky: userAPubky })).rejects.toBe(error);

      expect(useSyncStatusStore.getState().userPubky).toBeNull();
    });
  });
  describe('pending writes', () => {
    it('clears a pending write once a later check reports Nexus caught up', async () => {
      mockFetchCursorSnapshot.mockResolvedValue({ homeserverCursor: 10, nexusCursor: 10 });
      useSyncStatusStore.getState().markPendingWrite(NOW - 1_000);

      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });

      expect(useSyncStatusStore.getState().pendingWriteSince).toBeNull();
    });

    it('keeps a pending write when Nexus is still behind', async () => {
      mockFetchCursorSnapshot.mockResolvedValue({ homeserverCursor: 12, nexusCursor: 10 });
      const writtenAt = NOW - 1_000;
      useSyncStatusStore.getState().markPendingWrite(writtenAt);

      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });

      expect(useSyncStatusStore.getState().pendingWriteSince).toBe(writtenAt);
    });

    it('does not let a check that was already in flight clear the write', async () => {
      // The snapshot resolves after the write, but the request left before it.
      mockFetchCursorSnapshot.mockResolvedValue({ homeserverCursor: 10, nexusCursor: 10 });
      const writtenAt = NOW + 5_000;
      useSyncStatusStore.getState().markPendingWrite(writtenAt);

      await SyncStatusController.fetchSyncStatus({ userPubky: userAPubky });

      expect(useSyncStatusStore.getState().pendingWriteSince).toBe(writtenAt);
    });
  });
});
