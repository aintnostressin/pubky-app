import { AUTH_ROUTES } from '@/app/routes';
import {
  SYNC_STATUS_ACTIVE_POLL_INTERVAL_MS,
  SYNC_STATUS_ACTIVE_POLL_WINDOW_MS,
  SYNC_STATUS_POLL_INTERVAL_MS,
} from '@/config/sync-status';
import { SyncStatusController } from '@/controllers/sync-status/sync-status';
import { Coordinator } from '@/coordinators/base/coordinator';
import type { PollingInactiveReason } from '@/coordinators/base/coordinators.types';
import { routeToRegex } from '@/coordinators/base/coordinators.utils';
import type {
  SyncStatusCoordinatorConfig,
  SyncStatusCoordinatorState,
} from '@/coordinators/sync-status/sync-status.types';
import { onHomeserverWrite } from '@/libs/homeserver-write/homeserver-write';
import { Logger } from '@/libs/logger/logger';
import { useAuthStore } from '@/stores/auth/auth.store';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';
import { SyncStatus } from '@/stores/syncStatus/syncStatus.types';

/**
 * SyncStatusCoordinator
 *
 * Centralized coordinator for polling the sync status of the signed-in
 * user's content: compares the user's latest homeserver event cursor with
 * the last cursor processed by Nexus and stores the result in the
 * sync-status store.
 *
 * This is a singleton coordinator that should be accessed via getInstance().
 * Typically managed by the CoordinatorsManager component in the app layout.
 *
 * Polling runs on two cadences:
 * - idle: the configured interval, to catch Nexus falling behind on its own
 * - active: a short burst started by every homeserver write of the current
 *   user, so their own tag/post/follow shows up as "Syncing" right away and
 *   clears as soon as Nexus catches up
 *
 * The coordinator's only responsibility is to poll and update the store. UI
 * components read the store using useSyncStatusStore to render the avatar
 * sync indicator.
 */
export class SyncStatusCoordinator extends Coordinator<SyncStatusCoordinatorConfig, SyncStatusCoordinatorState> {
  private static instance: SyncStatusCoordinator | null = null;

  // Extended configuration
  private syncStatusConfig: Required<Pick<SyncStatusCoordinatorConfig, 'disabledRoutes'>> = {
    disabledRoutes: [routeToRegex('/onboarding'), routeToRegex(AUTH_ROUTES.LOGOUT), routeToRegex(AUTH_ROUTES.SIGN_IN)],
  };

  /**
   * Unsubscribe function for the homeserver-write subscription.
   *
   * IMPORTANT: no field initializer — the parent constructor calls
   * setupListeners() before child field initializers run, so `= null` here
   * would overwrite the subscription. Same hazard as StreamCoordinator.
   */
  private homeserverWriteUnsubscribe!: (() => void) | null;

  // Active-poll burst state (chained timeout, so polls never overlap)
  private activePollTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private activePollUntil = 0;

  private constructor() {
    super({ initialConfig: { intervalMs: SYNC_STATUS_POLL_INTERVAL_MS } });
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get the singleton instance of SyncStatusCoordinator
   */
  public static getInstance(): SyncStatusCoordinator {
    if (!SyncStatusCoordinator.instance) {
      SyncStatusCoordinator.instance = new SyncStatusCoordinator();
    }
    return SyncStatusCoordinator.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (SyncStatusCoordinator.instance) {
      SyncStatusCoordinator.instance.destroy();
      SyncStatusCoordinator.instance = null;
    }
  }

  // ============================================================================
  // Protected API (abstract method implementations)
  // ============================================================================

  /**
   * Execute a single poll operation
   */
  protected async poll(): Promise<void> {
    const userPubky = useAuthStore.getState().selectCurrentUserPubky();
    if (!userPubky) {
      return;
    }

    try {
      await SyncStatusController.fetchSyncStatus({ userPubky });
    } catch (error) {
      // Keep the previous store state on failure; the next poll retries.
      Logger.error('Error polling sync status', { error });
    }
  }

  /**
   * Check if current route is allowed (not in disabled routes list)
   */
  protected isRouteAllowed(): boolean {
    const state = this.getState();
    return !this.syncStatusConfig.disabledRoutes.some((pattern) => pattern.test(state.currentRoute));
  }

  /**
   * Setup event listeners for auth state, page visibility and homeserver writes
   */
  protected setupListeners(): void {
    super.setupListeners();
    this.homeserverWriteUnsubscribe = onHomeserverWrite(() => this.handleHomeserverWrite());
  }

  /**
   * Remove all event listeners
   */
  protected removeListeners(): void {
    super.removeListeners();

    if (this.homeserverWriteUnsubscribe) {
      this.homeserverWriteUnsubscribe();
      this.homeserverWriteUnsubscribe = null;
    }
  }

  /**
   * Stop the polling interval, including any in-flight active-poll burst
   */
  protected stopPolling(reason: PollingInactiveReason): void {
    this.stopActivePolling();
    super.stopPolling(reason);
  }

  // ============================================================================
  // Private API
  // ============================================================================

  /**
   * The user just wrote to their homeserver, so Nexus is behind until it
   * indexes that event: poll now and keep polling until it catches up.
   */
  private handleHomeserverWrite(): void {
    if (!this.shouldPoll()) {
      return;
    }

    this.activePollUntil = Date.now() + SYNC_STATUS_ACTIVE_POLL_WINDOW_MS;
    this.scheduleActivePoll(0);
  }

  /**
   * Schedule the next active poll, replacing any pending one so a burst of
   * writes collapses into a single chain.
   */
  private scheduleActivePoll(delayMs: number): void {
    if (this.activePollTimeoutId) {
      clearTimeout(this.activePollTimeoutId);
    }

    this.activePollTimeoutId = setTimeout(() => {
      this.activePollTimeoutId = null;
      void this.runActivePoll();
    }, delayMs);
  }

  /**
   * Run one active poll and chain the next one while Nexus is still behind
   * and the burst window has not expired.
   */
  private async runActivePoll(): Promise<void> {
    if (!this.shouldPoll()) {
      this.stopActivePolling();
      return;
    }

    await this.poll();

    const isSynced = useSyncStatusStore.getState().selectSyncStatus() === SyncStatus.SYNCED;
    if (isSynced || Date.now() >= this.activePollUntil) {
      this.stopActivePolling();
      return;
    }

    this.scheduleActivePoll(SYNC_STATUS_ACTIVE_POLL_INTERVAL_MS);
  }

  /**
   * Cancel the active-poll burst and fall back to the idle interval
   */
  private stopActivePolling(): void {
    if (this.activePollTimeoutId) {
      clearTimeout(this.activePollTimeoutId);
      this.activePollTimeoutId = null;
    }
    this.activePollUntil = 0;
  }
}
