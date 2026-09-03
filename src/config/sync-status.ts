/**
 * Sync Status Configuration
 *
 * Settings for the header sync-status indicator, which compares the user's
 * latest homeserver event cursor with the last cursor processed by Nexus.
 *
 * The values are intentionally fixed (not environment-configurable) — they
 * express product-level polling behavior, not deployment configuration.
 */

/** Idle interval at which the sync-status coordinator polls the homeserver and Nexus cursors */
export const SYNC_STATUS_POLL_INTERVAL_MS = 30_000;

/** Interval used while the user's own writes are still being indexed by Nexus */
export const SYNC_STATUS_ACTIVE_POLL_INTERVAL_MS = 2_000;

/**
 * How long a homeserver write keeps the coordinator on the active interval.
 * The coordinator drops back to the idle interval as soon as Nexus catches up,
 * so this only bounds the window when Nexus stays behind.
 */
export const SYNC_STATUS_ACTIVE_POLL_WINDOW_MS = 60_000;

/** Mismatches older than this are considered stale (not syncing) instead of in-progress (syncing) */
export const SYNC_STATUS_MISMATCH_TOLERANCE_MS = 120_000;
