import { SYNC_STATUS_MISMATCH_TOLERANCE_MS } from '@/config/sync-status';
import { ZustandGet } from '../stores.types';
import { SyncStatus, type SyncStatusSelectors, type SyncStatusStore } from './syncStatus.types';

// Selectors - State access functions with validation
export const createSyncStatusSelectors = (get: ZustandGet<SyncStatusStore>): SyncStatusSelectors => ({
  /**
   * Derives the display status from the raw cursor snapshot:
   * - UNKNOWN before the first completed comparison (indicator hidden)
   * - SYNCED when the Nexus cursor has caught up (comparison uses `>=`
   *   because primary-homeserver cursors may advance to batch-end values)
   * - OUT_OF_SYNC while the mismatch is within the tolerance window
   * - OUT_OF_SYNC_STALE once the mismatch exceeds the tolerance
   */
  selectSyncStatus: () => {
    const { homeserverCursor, nexusCursor, mismatchSince } = get();

    if (homeserverCursor === null || nexusCursor === null) {
      return SyncStatus.UNKNOWN;
    }

    if (nexusCursor >= homeserverCursor) {
      return SyncStatus.SYNCED;
    }

    const mismatchAgeMs = Date.now() - (mismatchSince ?? Date.now());
    return mismatchAgeMs > SYNC_STATUS_MISMATCH_TOLERANCE_MS ? SyncStatus.OUT_OF_SYNC_STALE : SyncStatus.OUT_OF_SYNC;
  },
});
