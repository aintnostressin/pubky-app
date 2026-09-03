/**
 * Homeserver write notifier
 *
 * A tiny synchronous pub/sub used to announce that the signed-in user just
 * wrote to (or deleted from) their homeserver. It lives in `libs/` on purpose:
 * the emitter is a service (`HomeserverService`) and the subscriber is a
 * coordinator (`SyncStatusCoordinator`), so a layer-neutral module keeps the
 * dependency one-way and avoids an import cycle.
 */

type HomeserverWriteListener = () => void;

const listeners = new Set<HomeserverWriteListener>();

/** Subscribes to homeserver writes. Returns an unsubscribe function. */
export function onHomeserverWrite(listener: HomeserverWriteListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Announces a successful homeserver write. Listener failures never break the write path. */
export function notifyHomeserverWrite(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken listener must not fail the write that triggered it.
    }
  }
}
