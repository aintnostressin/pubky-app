import type { PollingServiceConfig, PollingServiceState } from '@/coordinators/base/coordinators.types';

/**
 * Sync Status Coordinator Types
 *
 * Type definitions for the sync-status polling coordinator.
 * Extends common coordinator types with sync-status-specific configuration.
 */

/**
 * Sync-status coordinator internal state
 *
 * No sync-status-specific state is needed beyond the base polling state.
 */
export type SyncStatusCoordinatorState = PollingServiceState;

/**
 * Configuration options for the sync-status polling coordinator
 */
export interface SyncStatusCoordinatorConfig extends PollingServiceConfig {
  /**
   * Polling interval in milliseconds
   * @default 30000 (30 seconds)
   */
  intervalMs?: number;

  /**
   * Routes where polling should be disabled (regex patterns)
   * @default [/^\/onboarding/, /^\/logout/, /^\/sign-in/]
   */
  disabledRoutes?: RegExp[];
}
