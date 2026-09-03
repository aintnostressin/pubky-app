import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createSyncStatusActions } from './syncStatus.actions';
import { createSyncStatusSelectors } from './syncStatus.selectors';
import { syncStatusInitialState, type SyncStatusStore } from './syncStatus.types';

/**
 * Sync Status Store
 *
 * Ephemeral (non-persisted) store holding the latest cursor comparison for
 * the signed-in user. Updated by the sync-status coordinator polling,
 * consumed by the avatar sync indicator in the header and mobile footer.
 */
export const useSyncStatusStore = create<SyncStatusStore>()(
  devtools(
    (set, get) => ({
      ...syncStatusInitialState,
      ...createSyncStatusActions(set),
      ...createSyncStatusSelectors(get),
    }),
    {
      name: 'sync-status-store',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);
