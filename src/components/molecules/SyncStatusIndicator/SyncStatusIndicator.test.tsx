import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SYNC_STATUS_MISMATCH_TOLERANCE_MS } from '@/config/sync-status';
import type { Pubky } from '@/models/models.types';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';
import type { SyncStatusState } from '@/stores/syncStatus/syncStatus.types';
import { SyncStatusIndicator } from './SyncStatusIndicator';

const testUserPubky = 'qr3xqyz3e5cyf9npgxc5zfp15ehhcis6gqsxob4une7bwwazekry' as Pubky;

const setSyncState = (overrides: Partial<SyncStatusState> = {}) => {
  useSyncStatusStore.getState().setSyncState({
    userPubky: testUserPubky,
    homeserverCursor: 100,
    nexusCursor: 100,
    mismatchSince: null,
    lastCheckedAt: Date.now(),
    ...overrides,
  });
};

const setBehind = (mismatchAgeMs: number) =>
  setSyncState({ homeserverCursor: 100, nexusCursor: 50, mismatchSince: Date.now() - mismatchAgeMs });

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().reset();
  });

  it('renders nothing before the first completed comparison', () => {
    const { container } = render(<SyncStatusIndicator />);

    expect(screen.queryByTestId('sync-status-indicator')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when synced', () => {
    setSyncState();

    const { container } = render(<SyncStatusIndicator />);

    expect(screen.queryByTestId('sync-status-indicator')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it('renders a syncing chip while the mismatch is within the tolerance window', () => {
    setBehind(1_000);

    render(<SyncStatusIndicator />);
    const indicator = screen.getByTestId('sync-status-indicator');

    expect(indicator).toHaveAttribute('data-status', 'out-of-sync');
    expect(indicator).toHaveAttribute('data-variant', 'chip');
    expect(indicator).toHaveTextContent('Syncing');
    expect(indicator).toHaveClass('text-yellow-500');
  });

  it('renders a not-syncing chip once the mismatch exceeds the tolerance', () => {
    setBehind(SYNC_STATUS_MISMATCH_TOLERANCE_MS + 1_000);

    render(<SyncStatusIndicator />);
    const indicator = screen.getByTestId('sync-status-indicator');

    expect(indicator).toHaveAttribute('data-status', 'out-of-sync-stale');
    expect(indicator).toHaveTextContent('Not syncing');
    expect(indicator).toHaveClass('text-red-500');
  });

  it('renders a yellow dot in the dot variant while syncing', () => {
    setBehind(1_000);

    render(<SyncStatusIndicator variant="dot" />);
    const indicator = screen.getByTestId('sync-status-indicator');

    expect(indicator).toHaveAttribute('data-variant', 'dot');
    expect(indicator).toHaveClass('bg-yellow-500');
    expect(indicator).toBeEmptyDOMElement();
  });

  it('renders a red dot in the dot variant once the mismatch is stale', () => {
    setBehind(SYNC_STATUS_MISMATCH_TOLERANCE_MS + 1_000);

    render(<SyncStatusIndicator variant="dot" />);

    expect(screen.getByTestId('sync-status-indicator')).toHaveClass('bg-red-500');
  });

  it('exposes a status role with a human-readable label', () => {
    setBehind(1_000);

    render(<SyncStatusIndicator />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Syncing with Pubky Nexus');
  });

  it('merges the provided className', () => {
    setBehind(1_000);

    render(<SyncStatusIndicator variant="dot" className="absolute top-0 right-0" />);

    expect(screen.getByTestId('sync-status-indicator')).toHaveClass('absolute', 'top-0', 'right-0');
  });
});
