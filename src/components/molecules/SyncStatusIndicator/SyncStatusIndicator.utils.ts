/**
 * Formats an elapsed duration for the sync-status details popover.
 *
 * Deliberately coarse: the popover answers "is this seconds old or minutes
 * old", not "how many milliseconds exactly".
 */
export function formatAge(elapsedMs: number): string {
  if (elapsedMs < 5_000) {
    return 'just now';
  }

  const seconds = Math.floor(elapsedMs / 1_000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/** Formats a duration a mismatch has lasted ("2m", "1h"), without the "ago" suffix */
export function formatDuration(elapsedMs: number): string {
  const seconds = Math.max(Math.floor(elapsedMs / 1_000), 0);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
