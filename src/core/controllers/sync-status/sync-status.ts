import { SyncStatusApplication } from '@/application/sync-status/sync-status';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';
import type { TSyncStatusFetchStatusParams } from './sync-status.types';

/**
 * SyncStatusController
 *
 * Bridges the sync-status coordinator with the application layer and the
 * sync-status store. Translates a fresh cursor snapshot into store state,
 * including mismatch tracking (how long the user has been out of sync).
 */
export class SyncStatusController {
  /**
   * Fetches the latest homeserver and Nexus cursors for the user and updates
   * the sync-status store. Fetch failures reject; the caller (coordinator)
   * is expected to log them and keep the previous store state.
   */
  static async fetchSyncStatus({ userPubky }: TSyncStatusFetchStatusParams): Promise<void> {
    const { homeserverCursor, nexusCursor } = await SyncStatusApplication.fetchCursorSnapshot({ userPubky });

    const now = Date.now();
    const previous = useSyncStatusStore.getState();
    const isSameUser = previous.userPubky === userPubky;
    const isBehind = homeserverCursor > nexusCursor;

    useSyncStatusStore.getState().setSyncState({
      userPubky,
      homeserverCursor,
      nexusCursor,
      lastCheckedAt: now,
      // Keep the original mismatch timestamp so the indicator can age from
      // yellow to red; reset it on recovery or account switch.
      mismatchSince: isBehind ? (isSameUser && previous.mismatchSince !== null ? previous.mismatchSince : now) : null,
    });
  }
}
