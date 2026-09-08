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

  recordCheckFailure: (failedAt: number) => {
    set(
      (state) => ({ consecutiveFailures: state.consecutiveFailures + 1, lastFailureAt: failedAt }),
      false,
      SyncStatusActionTypes.RECORD_CHECK_FAILURE,
    );
  },

  markPendingWrite: (writtenAt: number) => {
    set({ pendingWriteSince: writtenAt }, false, SyncStatusActionTypes.MARK_PENDING_WRITE);
  },

  reset: () => {
    set(syncStatusInitialState, false, SyncStatusActionTypes.RESET);
  },
});
