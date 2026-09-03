import type { Pubky } from '@/models/models.types';

/**
 * Sync Status Controller Types
 */

export type TSyncStatusFetchStatusParams = {
  /** Pubky of the user to refresh sync status for */
  userPubky: Pubky;
};
