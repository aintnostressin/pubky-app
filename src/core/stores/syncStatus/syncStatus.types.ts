import type { Pubky } from '@/models/models.types';

/**
 * Sync Status Store Types
 *
 * Tracks the comparison between the user's latest homeserver event cursor
 * and the last cursor processed by Nexus. The display status is derived from
 * the raw cursors (see `selectSyncStatus`).
 */

/** Raw cursor snapshot data for the sync status indicator */
export interface SyncStatusState {
  /** Pubky of the user this snapshot belongs to (null before the first completed check) */
  userPubky: Pubky | null;
  /** Latest public event cursor on the user's homeserver */
  homeserverCursor: number | null;
  /** Last homeserver event cursor processed by Nexus */
  nexusCursor: number | null;
  /** Timestamp when the current mismatch was first observed (null when in sync) */
  mismatchSince: number | null;
  /**
   * Largest cursor gap seen during the current mismatch, so the indicator can
   * show how much of it has been closed rather than an indeterminate spinner.
   * Null when in sync.
   */
  mismatchPeakGap: number | null;
  /** Timestamp of the last completed cursor comparison */
  lastCheckedAt: number | null;
  /**
   * When the user last wrote to their homeserver. Nexus is behind from that
   * instant by definition, so the indicator shows it without waiting for a
   * poll to prove it. Cleared by the first check that started after the write
   * and came back synced.
   */
  pendingWriteSince: number | null;
  /** Consecutive failed checks since the last completed comparison */
  consecutiveFailures: number;
  /** Timestamp of the most recent failed check (null when the last check succeeded) */
  lastFailureAt: number | null;
}

/** Display status derived from the raw cursor snapshot */
export enum SyncStatus {
  /** No completed comparison yet (indicator hidden) */
  UNKNOWN = 'unknown',
  /** Nexus cursor has caught up with the homeserver cursor (indicator hidden) */
  SYNCED = 'synced',
  /** Nexus is behind but the mismatch is recent (yellow "Syncing" chip) */
  OUT_OF_SYNC = 'out-of-sync',
  /** Nexus has been behind longer than the mismatch tolerance (orange "Sync delayed" chip) */
  OUT_OF_SYNC_STALE = 'out-of-sync-stale',
  /**
   * The checks themselves are failing, so the cursor comparison is unknown
   * rather than merely behind (red "Can't reach Nexus" chip). Takes precedence
   * over the cursor-derived states: a silent failure used to look identical to
   * a healthy sync.
   */
  CHECK_FAILING = 'check-failing',
}

export interface SyncStatusActions {
  setSyncState: (state: SyncStatusState) => void;
  /** Record a check that never completed, so the UI can distinguish down from synced */
  recordCheckFailure: (failedAt: number) => void;
  /** The user just wrote to their homeserver: show "syncing" straight away */
  markPendingWrite: (writtenAt: number) => void;
  reset: () => void;
}

export interface SyncStatusSelectors {
  selectSyncStatus: () => SyncStatus;
}

export type SyncStatusStore = SyncStatusState & SyncStatusActions & SyncStatusSelectors;

export const syncStatusInitialState: SyncStatusState = {
  userPubky: null,
  homeserverCursor: null,
  nexusCursor: null,
  mismatchSince: null,
  mismatchPeakGap: null,
  pendingWriteSince: null,
  lastCheckedAt: null,
  consecutiveFailures: 0,
  lastFailureAt: null,
};

export enum SyncStatusActionTypes {
  INIT = 'INIT',
  SET_SYNC_STATE = 'SET_SYNC_STATE',
  RECORD_CHECK_FAILURE = 'RECORD_CHECK_FAILURE',
  MARK_PENDING_WRITE = 'MARK_PENDING_WRITE',
  RESET = 'RESET',
}
