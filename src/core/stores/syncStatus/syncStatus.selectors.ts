import { SYNC_STATUS_FAILED_CHECK_THRESHOLD, SYNC_STATUS_MISMATCH_TOLERANCE_MS } from '@/config/sync-status';
import { ZustandGet } from '../stores.types';
import { SyncStatus, type SyncStatusSelectors, type SyncStatusStore } from './syncStatus.types';

// Selectors - State access functions with validation
export const createSyncStatusSelectors = (get: ZustandGet<SyncStatusStore>): SyncStatusSelectors => ({
  /**
   * Derives the display status from the raw cursor snapshot:
   * - CHECK_FAILING when consecutive checks have failed, whatever the last
   *   known cursors were: a Nexus we cannot reach is not a Nexus we know to
   *   be in sync, so this is checked first
   * - OUT_OF_SYNC as soon as the user writes, before any poll confirms it:
   *   their own write is proof enough that Nexus is behind
   * - UNKNOWN before the first completed comparison (indicator hidden)
   * - SYNCED when the Nexus cursor has caught up (comparison uses `>=`
   *   because primary-homeserver cursors may advance to batch-end values)
   * - OUT_OF_SYNC while the mismatch is within the tolerance window
   * - OUT_OF_SYNC_STALE once the mismatch exceeds the tolerance
   */
  selectSyncStatus: () => {
    const { homeserverCursor, nexusCursor, mismatchSince, consecutiveFailures, pendingWriteSince } = get();

    if (consecutiveFailures >= SYNC_STATUS_FAILED_CHECK_THRESHOLD) {
      return SyncStatus.CHECK_FAILING;
    }

    const isBehind = homeserverCursor !== null && nexusCursor !== null && nexusCursor < homeserverCursor;

    if (!isBehind && pendingWriteSince === null) {
      return homeserverCursor === null || nexusCursor === null ? SyncStatus.UNKNOWN : SyncStatus.SYNCED;
    }

    // An unconfirmed write ages from the moment it was made, exactly like a
    // cursor mismatch does — whichever started first drives the colour.
    const behindSince = Math.min(mismatchSince ?? Date.now(), pendingWriteSince ?? Date.now());
    const mismatchAgeMs = Date.now() - behindSince;
    return mismatchAgeMs > SYNC_STATUS_MISMATCH_TOLERANCE_MS ? SyncStatus.OUT_OF_SYNC_STALE : SyncStatus.OUT_OF_SYNC;
  },
});
