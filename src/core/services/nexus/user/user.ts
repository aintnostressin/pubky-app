import type {
  NexusNotification,
  NexusTag,
  NexusTaggers,
  NexusUserCounts,
  NexusUserCursor,
  NexusUserDetails,
  TUserId,
} from '@/services/nexus/nexus.types';
import { fetchNexus, queryNexus } from '@/services/nexus/nexus.utils';
import { userApi } from '@/services/nexus/user/user.api';
import type { TUserPaginationParams, TUserTaggersParams, TUserTagsParams } from '@/services/nexus/user/user.types';

/**
 * Nexus User Service
 *
 * Handles fetching user data from Nexus API.
 */
export class NexusUserService {
  /**
   * Retrieves user data from Nexus API
   *
   * @param pubky - User's public key
   * @returns user data (users, posts, streams)
   */
  static async notifications(params: TUserPaginationParams): Promise<NexusNotification[]> {
    const url = userApi.notifications(params);
    return await queryNexus<NexusNotification[]>({ url });
  }

  /**
   * Retrieves tags for a user from Nexus API
   *
   * @param params - Parameters containing user ID and pagination options
   * @returns Array of tags assigned to the user
   */
  static async tags(params: TUserTagsParams): Promise<NexusTag[]> {
    const url = userApi.tags(params);
    return await queryNexus<NexusTag[]>({ url });
  }

  /**
   * Retrieves taggers for a specific tag label on a user from Nexus API
   *
   * @param params - Parameters containing user ID, label, and pagination options
   * @returns Array of users who tagged the user with the specified label
   */
  static async taggers(params: TUserTaggersParams): Promise<NexusTaggers[]> {
    const url = userApi.taggers(params);
    return await queryNexus<NexusTaggers[]>({ url });
  }

  /**
   * Retrieves user details from Nexus API
   *
   * @param params - Parameters containing user ID
   * @returns User details including name, bio, status, image, and links
   */
  static async details(params: TUserId): Promise<NexusUserDetails> {
    const url = userApi.details(params);
    return await queryNexus<NexusUserDetails>({ url });
  }

  /**
   * Retrieves user counts from Nexus API
   *
   * @param params - Parameters containing user ID
   * @returns User counts including followers, following, and friends
   */
  static async counts(params: TUserId): Promise<NexusUserCounts> {
    const url = userApi.counts(params);
    return await queryNexus<NexusUserCounts>({ url });
  }

  /**
   * Retrieves the last homeserver event cursor processed by Nexus for a user
   *
   * Uses a raw fetch (no TanStack Query cache/retry) because this endpoint
   * is polled by the sync-status coordinator: the query client's staleTime
   * would risk serving stale cursors and its 404 retry policy would delay
   * the polling loop for users Nexus has not indexed yet.
   *
   * @param params - Parameters containing user ID
   * @returns Cursor information for the user
   */
  static async cursor(params: TUserId): Promise<NexusUserCursor> {
    const url = userApi.cursor(params);
    return await fetchNexus<NexusUserCursor>({ url });
  }
}
