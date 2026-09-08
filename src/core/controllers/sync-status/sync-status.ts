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
    // Captured before the fetch: a check already in flight when the user wrote
    // cannot clear that write, however synced its answer looks.
    const startedAt = Date.now();
    const { homeserverCursor, nexusCursor } = await SyncStatusApplication.fetchCursorSnapshot({ userPubky });

    const now = Date.now();
    const previous = useSyncStatusStore.getState();
    const isSameUser = previous.userPubky === userPubky;
    const isBehind = homeserverCursor > nexusCursor;
    const gap = Math.max(homeserverCursor - nexusCursor, 0);
    const previousPeak = isSameUser ? (previous.mismatchPeakGap ?? 0) : 0;

    useSyncStatusStore.getState().setSyncState({
      userPubky,
      homeserverCursor,
      nexusCursor,
      lastCheckedAt: now,
      // A completed comparison clears the failure streak that drives the
      // "can't reach Nexus" state.
      consecutiveFailures: 0,
      lastFailureAt: null,
      // Keep the original mismatch timestamp so the indicator can age from
      // yellow to red; reset it on recovery or account switch.
      mismatchSince: isBehind ? (isSameUser && previous.mismatchSince !== null ? previous.mismatchSince : now) : null,
      // The peak is the denominator of the ring's progress arc: it only grows
      // while the mismatch lasts, so the arc never jumps backwards when new
      // events arrive mid-catch-up.
      mismatchPeakGap: isBehind ? Math.max(previousPeak, gap) : null,
      pendingWriteSince: SyncStatusController.nextPendingWrite({
        // Carried when the snapshot belongs to the same user, and when this is
        // the first snapshot of all: a write made right after sign-in, before
        // any check has ever completed, must not be dropped by that check.
        previousPendingWrite: isSameUser || previous.userPubky === null ? previous.pendingWriteSince : null,
        isBehind,
        startedAt,
      }),
    });
  }

  /**
   * A pending write survives until a check that began after it reports Nexus
   * as caught up. Keeping it while Nexus is still behind is harmless — the
   * cursor mismatch says the same thing — but clearing it on a stale in-flight
   * answer would blink the indicator off while the write is still unindexed.
   */
  private static nextPendingWrite({
    previousPendingWrite,
    isBehind,
    startedAt,
  }: {
    previousPendingWrite: number | null;
    isBehind: boolean;
    startedAt: number;
  }): number | null {
    if (previousPendingWrite === null) {
      return null;
    }

    return isBehind || startedAt <= previousPendingWrite ? previousPendingWrite : null;
  }
}
