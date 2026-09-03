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
  /** Timestamp of the last completed cursor comparison */
  lastCheckedAt: number | null;
}

/** Display status derived from the raw cursor snapshot */
export enum SyncStatus {
  /** No completed comparison yet (indicator hidden) */
  UNKNOWN = 'unknown',
  /** Nexus cursor has caught up with the homeserver cursor (indicator hidden) */
  SYNCED = 'synced',
  /** Nexus is behind but the mismatch is recent (yellow "Syncing" chip) */
  OUT_OF_SYNC = 'out-of-sync',
  /** Nexus has been behind longer than the mismatch tolerance (red "Not syncing" chip) */
  OUT_OF_SYNC_STALE = 'out-of-sync-stale',
}

export interface SyncStatusActions {
  setSyncState: (state: SyncStatusState) => void;
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
  lastCheckedAt: null,
};

export enum SyncStatusActionTypes {
  INIT = 'INIT',
  SET_SYNC_STATE = 'SET_SYNC_STATE',
  RESET = 'RESET',
}
