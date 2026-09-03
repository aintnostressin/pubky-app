import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncStatusApplication } from '@/application/sync-status/sync-status';
import { ClientErrorCode, ServerErrorCode } from '@/libs/error/error.codes';
import { Err } from '@/libs/error/error.factories';
import { ErrorService } from '@/libs/error/error.types';
import { HttpStatusCode } from '@/libs/http/http.types';
import type { Pubky } from '@/models/models.types';
import { HomeserverService } from '@/services/homeserver/homeserver';
import { NexusUserService } from '@/services/nexus/user/user';

vi.mock('@/services/homeserver/homeserver', () => ({
  HomeserverService: {
    fetchUserEventsCursor: vi.fn(),
  },
}));

vi.mock('@/services/nexus/user/user', () => ({
  NexusUserService: {
    cursor: vi.fn(),
  },
}));

const mockFetchUserEventsCursor = vi.mocked(HomeserverService.fetchUserEventsCursor);
const mockNexusCursor = vi.mocked(NexusUserService.cursor);

const testUserPubky = 'qr3xqyz3e5cyf9npgxc5zfp15ehhcis6gqsxob4une7bwwazekry' as Pubky;

describe('SyncStatusApplication', () => {
  beforeEach(() => {
    mockFetchUserEventsCursor.mockReset();
    mockNexusCursor.mockReset();
  });

  describe('fetchCursorSnapshot', () => {
    it('should fetch both cursors and combine them into a snapshot', async () => {
      mockNexusCursor.mockResolvedValue({
        user_id: testUserPubky,
        homeserver_id: 'homeserver-1',
        cursor: 42,
      });
      mockFetchUserEventsCursor.mockResolvedValue(100);

      const snapshot = await SyncStatusApplication.fetchCursorSnapshot({ userPubky: testUserPubky });

      expect(mockNexusCursor).toHaveBeenCalledWith({ user_id: testUserPubky });
      expect(mockFetchUserEventsCursor).toHaveBeenCalledWith({ userZ32: testUserPubky });
      expect(snapshot).toEqual({ homeserverCursor: 100, nexusCursor: 42 });
    });

    it('should treat a nexus 404 (user not indexed yet) as cursor 0', async () => {
      mockNexusCursor.mockRejectedValue(
        Err.client(ClientErrorCode.NOT_FOUND, 'Not found', {
          service: ErrorService.Nexus,
          operation: 'fetchNexus',
          context: { statusCode: HttpStatusCode.NOT_FOUND },
        }),
      );
      mockFetchUserEventsCursor.mockResolvedValue(10);

      const snapshot = await SyncStatusApplication.fetchCursorSnapshot({ userPubky: testUserPubky });

      expect(snapshot).toEqual({ homeserverCursor: 10, nexusCursor: 0 });
    });

    it('should reject when nexus fails with a non-404 error', async () => {
      const serverError = Err.server(ServerErrorCode.UNKNOWN_ERROR, 'Nexus unavailable', {
        service: ErrorService.Nexus,
        operation: 'fetchNexus',
        context: { statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR },
      });
      mockNexusCursor.mockRejectedValue(serverError);
      mockFetchUserEventsCursor.mockResolvedValue(10);

      await expect(SyncStatusApplication.fetchCursorSnapshot({ userPubky: testUserPubky })).rejects.toBe(serverError);
    });

    it('should reject when the homeserver cursor fetch fails', async () => {
      const homeserverError = Err.server(ServerErrorCode.UNKNOWN_ERROR, 'Homeserver unavailable', {
        service: ErrorService.Homeserver,
        operation: 'fetchUserEventsCursor',
      });
      mockNexusCursor.mockResolvedValue({
        user_id: testUserPubky,
        homeserver_id: 'homeserver-1',
        cursor: 1,
      });
      mockFetchUserEventsCursor.mockRejectedValue(homeserverError);

      await expect(SyncStatusApplication.fetchCursorSnapshot({ userPubky: testUserPubky })).rejects.toBe(
        homeserverError,
      );
    });
  });
});
