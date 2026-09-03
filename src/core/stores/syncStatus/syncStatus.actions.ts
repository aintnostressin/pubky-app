import { ZustandSet } from '../stores.types';
import {
  type SyncStatusActions,
  SyncStatusActionTypes,
  syncStatusInitialState,
  type SyncStatusState,
  type SyncStatusStore,
} from './syncStatus.types';

// Actions/Mutators - State modification functions
export const createSyncStatusActions = (set: ZustandSet<SyncStatusStore>): SyncStatusActions => ({
  setSyncState: (state: SyncStatusState) => {
    set(state, false, SyncStatusActionTypes.SET_SYNC_STATE);
  },

  reset: () => {
    set(syncStatusInitialState, false, SyncStatusActionTypes.RESET);
  },
});
