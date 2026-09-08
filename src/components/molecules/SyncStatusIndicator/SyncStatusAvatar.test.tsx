import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pubky } from '@/models/models.types';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';
import { SyncStatusAvatar } from './SyncStatusAvatar';

const mockIsTouchDevice = vi.fn(() => false);
vi.mock('@/hooks/useIsTouchDevice/useIsTouchDevice', () => ({
  useIsTouchDevice: () => mockIsTouchDevice(),
}));

const testUserPubky = 'qr3xqyz3e5cyf9npgxc5zfp15ehhcis6gqsxob4une7bwwazekry' as Pubky;

const setBehind = () =>
  useSyncStatusStore.getState().setSyncState({
    userPubky: testUserPubky,
    homeserverCursor: 100,
    nexusCursor: 50,
    mismatchSince: Date.now(),
    mismatchPeakGap: 50,
    pendingWriteSince: null,
    lastCheckedAt: Date.now(),
    consecutiveFailures: 0,
    lastFailureAt: null,
  });

describe('SyncStatusAvatar', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().reset();
    mockIsTouchDevice.mockReturnValue(false);
  });

  it('opens the details on hovering the avatar, not just the ring band', () => {
    setBehind();
    render(
      <SyncStatusAvatar>
        <a href="/profile">avatar</a>
      </SyncStatusAvatar>,
    );

    expect(screen.queryByTestId('sync-status-check-now')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByTestId('sync-status-avatar'));

    expect(screen.getByTestId('sync-status-check-now')).toBeInTheDocument();
  });

  it('leaves the avatar click to the profile link', () => {
    setBehind();
    render(
      <SyncStatusAvatar>
        <a href="/profile" data-testid="profile-link">
          avatar
        </a>
      </SyncStatusAvatar>,
    );

    // The ring is a sibling of the link, so the link is still a plain anchor.
    expect(screen.getByTestId('profile-link').closest('button')).toBeNull();
  });

  it('does not open on hover on a touch device, where the sheet is the surface', () => {
    setBehind();
    mockIsTouchDevice.mockReturnValue(true);
    render(
      <SyncStatusAvatar detailsSurface="sheet">
        <a href="/profile">avatar</a>
      </SyncStatusAvatar>,
    );

    fireEvent.mouseEnter(screen.getByTestId('sync-status-avatar'));

    expect(screen.queryByTestId('sync-status-check-now')).not.toBeInTheDocument();
  });
});
