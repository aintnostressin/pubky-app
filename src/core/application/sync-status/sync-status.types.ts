import type { Pubky } from '@/models/models.types';

/**
 * Sync Status Application Types
 */

export type TSyncStatusFetchSnapshotParams = {
  /** Pubky of the user to compare cursors for */
  userPubky: Pubky;
};

/** Cursor snapshot comparing homeserver state with Nexus state */
export type TCursorSnapshot = {
  /** Latest public event cursor on the user's homeserver */
  homeserverCursor: number;
  /** Last homeserver event cursor processed by Nexus (0 when Nexus has not indexed the user yet) */
  nexusCursor: number;
};
