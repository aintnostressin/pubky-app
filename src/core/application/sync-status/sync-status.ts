import { hasHttpStatus } from '@/libs/error/error.utils';
import { HttpStatusCode } from '@/libs/http/http.types';
import { HomeserverService } from '@/services/homeserver/homeserver';
import { NexusUserService } from '@/services/nexus/user/user';
import type { TCursorSnapshot, TSyncStatusFetchSnapshotParams } from './sync-status.types';

/**
 * SyncStatusApplication
 *
 * Orchestrates the cursor comparison between the user's homeserver and Nexus.
 */
export class SyncStatusApplication {
  /**
   * Fetches the user's latest homeserver event cursor and the last cursor
   * processed by Nexus.
   *
   * A Nexus 404 (user not indexed yet) resolves as `nexusCursor: 0` — the
   * user effectively has nothing processed on Nexus. Any other failure
   * rejects so the caller can skip the update and retry on the next poll.
   */
  static async fetchCursorSnapshot(params: TSyncStatusFetchSnapshotParams): Promise<TCursorSnapshot> {
    const [nexusCursor, homeserverCursor] = await Promise.all([
      this.fetchNexusCursor(params),
      HomeserverService.fetchUserEventsCursor({ userZ32: params.userPubky }),
    ]);

    return { homeserverCursor, nexusCursor };
  }

  private static async fetchNexusCursor({ userPubky }: TSyncStatusFetchSnapshotParams): Promise<number> {
    try {
      const { cursor } = await NexusUserService.cursor({ user_id: userPubky });
      return cursor;
    } catch (error) {
      if (hasHttpStatus(error, HttpStatusCode.NOT_FOUND)) {
        return 0;
      }
      throw error;
    }
  }
}
