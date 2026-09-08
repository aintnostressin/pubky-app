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

/**
 * Consecutive failed checks before the indicator reports Nexus as unreachable.
 * One transient failure is normal (a dropped request, a sleeping tab waking up);
 * two in a row means the checks themselves are not getting through.
 */
export const SYNC_STATUS_FAILED_CHECK_THRESHOLD = 2;

/** How long the "Synced" confirmation stays on screen after Nexus catches up */
export const SYNC_STATUS_SYNCED_CONFIRMATION_MS = 2_500;
