import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYNC_STATUS_FAILED_CHECK_THRESHOLD, SYNC_STATUS_MISMATCH_TOLERANCE_MS } from '@/config/sync-status';
import type { Pubky } from '@/models/models.types';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';
import type { SyncStatusState } from '@/stores/syncStatus/syncStatus.types';
import { SyncStatusIndicator } from './SyncStatusIndicator';

// Render the popover inline so the details content can be asserted without
// driving Radix's open state (same approach as PopoverInviteHomeserver).
vi.mock('@/atoms/Popover/Popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  PopoverContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="popover-content" className={className}>
      {children}
    </div>
  ),
}));

const testUserPubky = 'qr3xqyz3e5cyf9npgxc5zfp15ehhcis6gqsxob4une7bwwazekry' as Pubky;

const setSyncState = (overrides: Partial<SyncStatusState> = {}) => {
  useSyncStatusStore.getState().setSyncState({
    userPubky: testUserPubky,
    homeserverCursor: 100,
    nexusCursor: 100,
    mismatchSince: null,
    mismatchPeakGap: null,
    pendingWriteSince: null,
    lastCheckedAt: Date.now(),
    consecutiveFailures: 0,
    lastFailureAt: null,
    ...overrides,
  });
};

const setBehind = (mismatchAgeMs: number) =>
  setSyncState({ homeserverCursor: 100, nexusCursor: 50, mismatchSince: Date.now() - mismatchAgeMs });

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    useSyncStatusStore.getState().reset();
  });

  it('renders no visible indicator before the first completed comparison', () => {
    render(<SyncStatusIndicator variant="ring" />);

    expect(screen.queryByTestId('sync-status-indicator')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('renders no visible indicator when synced without a preceding mismatch', () => {
    setSyncState();

    render(<SyncStatusIndicator variant="ring" />);

    expect(screen.queryByTestId('sync-status-indicator')).not.toBeInTheDocument();
  });

  it('keeps the live region mounted while nothing is displayed', () => {
    render(<SyncStatusIndicator variant="ring" />);

    // A role="status" element that only appears once it already holds text is
    // not reliably announced, so the region outlives the visible chip.
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders a syncing ring while the mismatch is within the tolerance window', () => {
    setBehind(1_000);

    render(<SyncStatusIndicator variant="ring" />);
    const indicator = screen.getByTestId('sync-status-indicator');

    expect(indicator).toHaveAttribute('data-status', 'out-of-sync');
    expect(indicator).toHaveAttribute('data-variant', 'ring');
    expect(screen.getByRole('status')).toHaveTextContent('Syncing with Pubky Nexus');
  });

  it('marks the ring delayed once the mismatch exceeds the tolerance', () => {
    setBehind(SYNC_STATUS_MISMATCH_TOLERANCE_MS + 1_000);

    render(<SyncStatusIndicator variant="ring" />);
    const indicator = screen.getByTestId('sync-status-indicator');

    expect(indicator).toHaveAttribute('data-status', 'out-of-sync-stale');
    expect(indicator.querySelector('circle.stroke-orange-500')).toBeInTheDocument();
  });

  it('keeps the chip out of the header for the quiet states', () => {
    // The chip is an escalation, not a second treatment: the ring carries
    // syncing and delayed on both platforms.
    setBehind(SYNC_STATUS_MISMATCH_TOLERANCE_MS + 1_000);

    render(<SyncStatusIndicator variant="chip" />);

    expect(screen.queryByTestId('sync-status-indicator')).not.toBeInTheDocument();
  });

  it('renders the labelled chip when Nexus cannot be reached', () => {
    setSyncState({ consecutiveFailures: SYNC_STATUS_FAILED_CHECK_THRESHOLD });

    render(<SyncStatusIndicator variant="chip" />);
    const indicator = screen.getByTestId('sync-status-indicator');

    expect(indicator).toHaveAttribute('data-status', 'check-failing');
    expect(indicator).toHaveTextContent("Can't reach Nexus");
    expect(indicator).toHaveClass('text-red-500');
  });

  it('leaves the announcement to the ring so a desktop chip cannot double it', () => {
    setSyncState({ consecutiveFailures: SYNC_STATUS_FAILED_CHECK_THRESHOLD });

    render(<SyncStatusIndicator variant="chip" />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a transient synced confirmation after Nexus catches up', () => {
    vi.useFakeTimers();
    try {
      setBehind(1_000);
      render(<SyncStatusIndicator variant="ring" />);

      act(() => setSyncState());
      const indicator = screen.getByTestId('sync-status-indicator');
      expect(indicator).toHaveAttribute('data-status', 'synced');
      expect(indicator.querySelector('circle.stroke-emerald-500')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Synced with Pubky Nexus');

      act(() => {
        vi.runOnlyPendingTimers();
      });
      expect(screen.queryByTestId('sync-status-indicator')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('spins the syncing ring only when motion is allowed', () => {
    setBehind(1_000);

    render(<SyncStatusIndicator variant="ring" />);

    expect(screen.getByTestId('sync-status-indicator').querySelector('svg')).toHaveClass(
      'animate-spin',
      'motion-reduce:animate-none',
    );
  });

  it('renders a tappable progress ring in the ring variant', () => {
    setBehind(1_000);

    render(<SyncStatusIndicator variant="ring" />);
    const indicator = screen.getByTestId('sync-status-indicator');

    expect(indicator.tagName).toBe('BUTTON');
    expect(indicator).toHaveAttribute('data-variant', 'ring');
    expect(indicator).toHaveAccessibleName(/Syncing with Pubky Nexus/);
    expect(indicator.querySelector('svg')).toHaveClass('animate-spin', 'motion-reduce:animate-none');
    expect(indicator.querySelector('circle.stroke-yellow-500')).toBeInTheDocument();
  });

  it('draws the ring arc from how much of the backlog Nexus has worked through', () => {
    // Peaked at 100 behind, now 25 behind: three quarters of the way round.
    setSyncState({ homeserverCursor: 200, nexusCursor: 175, mismatchSince: Date.now(), mismatchPeakGap: 100 });

    render(<SyncStatusIndicator variant="ring" />);
    const arc = screen.getByTestId('sync-status-indicator').querySelector('circle.stroke-yellow-500');
    const circumference = 2 * Math.PI * 28;
    const [drawn] = (arc?.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);

    expect(drawn / circumference).toBeCloseTo(0.75, 2);
  });

  it('starts the ring at the minimum arc for a write no check has covered yet', () => {
    // Cursors still equal — the ring is up only because of the write. A full
    // arc here blinked "nearly done" before snapping back on the first poll.
    setSyncState({ pendingWriteSince: Date.now() });

    render(<SyncStatusIndicator variant="ring" />);
    const arc = screen.getByTestId('sync-status-indicator').querySelector('circle.stroke-yellow-500');
    const circumference = 2 * Math.PI * 28;
    const [drawn] = (arc?.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);

    expect(drawn / circumference).toBeCloseTo(0.08, 2);
  });

  it('draws a broken ring, with no progress claim, when Nexus is unreachable', () => {
    setSyncState({ consecutiveFailures: SYNC_STATUS_FAILED_CHECK_THRESHOLD });

    render(<SyncStatusIndicator variant="ring" />);
    const arc = screen.getByTestId('sync-status-indicator').querySelector('circle.stroke-red-500');

    expect(arc).toHaveAttribute('stroke-dasharray', '3 7');
  });

  it('exposes cursor detail and a manual re-check in the details popover', () => {
    setBehind(30_000);

    render(<SyncStatusIndicator variant="ring" detailsSurface="popover" />);

    expect(screen.getByTestId('sync-status-events-behind')).toHaveTextContent('50 events behind');
    expect(screen.getByTestId('sync-status-last-checked')).toHaveTextContent('Last checked');
    expect(screen.getByTestId('sync-status-check-now')).toBeInTheDocument();
  });

  it('merges the provided className', () => {
    setBehind(1_000);

    render(<SyncStatusIndicator variant="ring" className="absolute top-0 right-0" />);

    expect(screen.getByTestId('sync-status-indicator')).toHaveClass('absolute', 'top-0', 'right-0');
  });
});
