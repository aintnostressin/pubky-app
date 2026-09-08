'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import type * as React from 'react';
import { Button } from '@/atoms/Button/Button';
import { Container } from '@/atoms/Container/Container';
import { Popover, PopoverContent, PopoverTrigger } from '@/atoms/Popover/Popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/atoms/Sheet/Sheet';
import { Typography } from '@/atoms/Typography/Typography';
import { SYNC_STATUS_SYNCED_CONFIRMATION_MS } from '@/config/sync-status';
import { cn } from '@/libs/utils/utils';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';
import { SyncStatus } from '@/stores/syncStatus/syncStatus.types';
import { formatAge, formatDuration } from './SyncStatusIndicator.utils';

/** Statuses that the indicator renders something for */
type VisibleStatus =
  | SyncStatus.OUT_OF_SYNC
  | SyncStatus.OUT_OF_SYNC_STALE
  | SyncStatus.CHECK_FAILING
  | SyncStatus.SYNCED;

interface SyncStatusDisplay {
  label: string;
  ariaLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  spin: boolean;
  chipClassName: string;
  /** Ring stroke colour (mobile) and details icon tint */
  strokeClassName: string;
  tintClassName: string;
}

const SYNC_STATUS_CONFIG: Record<VisibleStatus, SyncStatusDisplay> = {
  [SyncStatus.OUT_OF_SYNC]: {
    label: 'Syncing',
    ariaLabel: 'Syncing with Pubky Nexus',
    description: 'Nexus is indexing your latest changes. They will appear in feeds and search shortly.',
    icon: RefreshCw,
    spin: true,
    chipClassName: 'bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/25',
    strokeClassName: 'stroke-yellow-500',
    tintClassName: 'bg-yellow-500/15 text-yellow-500',
  },
  [SyncStatus.OUT_OF_SYNC_STALE]: {
    label: 'Sync delayed',
    // Reserving red (and alarm) for a Nexus we cannot reach: being behind for
    // a couple of minutes is routine during a backfill or a large upload.
    ariaLabel: 'Sync delayed: Pubky Nexus is behind your homeserver',
    description: 'Nexus is taking longer than usual to catch up. Your content is safe on your homeserver either way.',
    icon: TriangleAlert,
    spin: false,
    chipClassName: 'bg-orange-500/15 text-orange-500 hover:bg-orange-500/25',
    strokeClassName: 'stroke-orange-500',
    tintClassName: 'bg-orange-500/15 text-orange-500',
  },
  [SyncStatus.CHECK_FAILING]: {
    label: "Can't reach Nexus",
    ariaLabel: 'Cannot reach Pubky Nexus',
    description: 'Sync checks are not getting through. Nexus may be down, or this device may be offline.',
    icon: CloudOff,
    spin: false,
    chipClassName: 'bg-red-500/15 text-red-500 hover:bg-red-500/25',
    strokeClassName: 'stroke-red-500',
    tintClassName: 'bg-red-500/15 text-red-500',
  },
  [SyncStatus.SYNCED]: {
    label: 'Synced',
    ariaLabel: 'Synced with Pubky Nexus',
    description: 'Nexus has caught up with your homeserver.',
    icon: Check,
    spin: false,
    chipClassName: 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25',
    strokeClassName: 'stroke-emerald-500',
    tintClassName: 'bg-emerald-500/15 text-emerald-500',
  },
};

/** Ring geometry: a 64px box around the 48px footer avatar */
const RING_RADIUS = 28;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/**
 * The arc never reads as empty or as complete while there is still a gap: a
 * closed ring is reserved for the "synced" confirmation, which draws the full
 * circumference directly rather than going through the progress calculation.
 */
const RING_MIN_PROGRESS = 0.08;
const RING_MAX_PROGRESS = 0.92;

const isBehind = (status: SyncStatus): boolean =>
  status === SyncStatus.OUT_OF_SYNC || status === SyncStatus.OUT_OF_SYNC_STALE || status === SyncStatus.CHECK_FAILING;

/**
 * Which status to paint, including the short-lived "Synced" confirmation shown
 * after Nexus catches up. Without it, the indicator simply vanishes and the
 * absence of a marker means both "all caught up" and "never checked".
 */
function useDisplayStatus(status: SyncStatus): VisibleStatus | null {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;

    if (status !== SyncStatus.SYNCED) {
      setShowConfirmation(false);
      return;
    }

    if (!isBehind(previous)) {
      return;
    }

    setShowConfirmation(true);
    const timeoutId = setTimeout(() => setShowConfirmation(false), SYNC_STATUS_SYNCED_CONFIRMATION_MS);
    return () => clearTimeout(timeoutId);
  }, [status]);

  if (isBehind(status)) {
    return status as VisibleStatus;
  }

  return status === SyncStatus.SYNCED && showConfirmation ? SyncStatus.SYNCED : null;
}

/**
 * How much of the mismatch Nexus has already worked through, as a 0-1 arc.
 * Measured against the largest gap seen during this mismatch, so the arc only
 * ever moves forwards.
 */
function useSyncProgress(): number {
  const homeserverCursor = useSyncStatusStore((state) => state.homeserverCursor);
  const nexusCursor = useSyncStatusStore((state) => state.nexusCursor);
  const mismatchPeakGap = useSyncStatusStore((state) => state.mismatchPeakGap);

  if (homeserverCursor === null || nexusCursor === null) {
    return RING_MIN_PROGRESS;
  }

  const gap = Math.max(homeserverCursor - nexusCursor, 0);
  const peak = mismatchPeakGap ?? gap;

  // No measured gap yet — the ring is up because the user just wrote and no
  // check has come back. Start at the minimum: a full arc here read as "almost
  // done" and then snapped back to a stub as soon as the first poll landed.
  if (peak <= 0) {
    return RING_MIN_PROGRESS;
  }

  const done = (peak - gap) / peak;
  return Math.min(Math.max(done, RING_MIN_PROGRESS), RING_MAX_PROGRESS);
}

/** Cursor detail, freshness and a manual re-check — shared by the popover and the sheet */
function SyncStatusDetails({ status, display }: { status: VisibleStatus; display: SyncStatusDisplay }) {
  const homeserverCursor = useSyncStatusStore((state) => state.homeserverCursor);
  const nexusCursor = useSyncStatusStore((state) => state.nexusCursor);
  const lastCheckedAt = useSyncStatusStore((state) => state.lastCheckedAt);
  const mismatchSince = useSyncStatusStore((state) => state.mismatchSince);
  const [isChecking, setIsChecking] = useState(false);

  // Sampled when the surface opens: good enough for "12s ago", and it keeps
  // the closed indicator from re-rendering on a timer.
  const [now] = useState(() => Date.now());

  const eventsBehind =
    homeserverCursor !== null && nexusCursor !== null ? Math.max(homeserverCursor - nexusCursor, 0) : null;

  const handleCheckNow = useCallback(async () => {
    setIsChecking(true);
    try {
      // Imported lazily so the indicator does not pull the coordinator (and
      // its dependency graph) into every page that renders the header.
      const { SyncStatusCoordinator } = await import('@/coordinators/sync-status/sync-status');
      await SyncStatusCoordinator.getInstance().refreshNow();
    } finally {
      setIsChecking(false);
    }
  }, []);

  return (
    <Container className="gap-3">
      <Container className="gap-1">
        <Typography size="sm" className="font-semibold text-popover-foreground">
          {display.label}
        </Typography>
        <Typography size="sm" className="leading-tight font-medium text-muted-foreground">
          {display.description}
        </Typography>
      </Container>

      <Container className="gap-0.5">
        {eventsBehind !== null && status !== SyncStatus.SYNCED && (
          <Typography size="xs" className="text-muted-foreground" data-testid="sync-status-events-behind">
            {eventsBehind === 1 ? '1 event behind' : `${eventsBehind} events behind`}
            {mismatchSince !== null && ` for ${formatDuration(now - mismatchSince)}`}
          </Typography>
        )}
        {lastCheckedAt !== null && (
          <Typography size="xs" className="text-muted-foreground" data-testid="sync-status-last-checked">
            Last checked {formatAge(now - lastCheckedAt)}
          </Typography>
        )}
      </Container>

      {status !== SyncStatus.SYNCED && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={handleCheckNow}
          disabled={isChecking}
          data-testid="sync-status-check-now"
        >
          {isChecking ? 'Checking…' : 'Check now'}
        </Button>
      )}
    </Container>
  );
}

/**
 * The mobile marker: an arc around the avatar rather than a dot beside it.
 *
 * The SVG is inert except for the ring band itself (`pointer-events: stroke` on
 * a fat transparent circle), so the avatar underneath keeps its own tap — the
 * ring opens sync details, the face still goes to the profile.
 */
function SyncStatusRing({
  status,
  display,
  progress,
}: {
  status: VisibleStatus;
  display: SyncStatusDisplay;
  progress: number;
}) {
  const isUnreachable = status === SyncStatus.CHECK_FAILING;
  const isSynced = status === SyncStatus.SYNCED;
  const arcLength = isUnreachable || isSynced ? RING_CIRCUMFERENCE : RING_CIRCUMFERENCE * progress;

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className={cn('size-full', display.spin && 'animate-spin [animation-duration:2.4s] motion-reduce:animate-none')}
    >
      {!isUnreachable && (
        <circle cx="32" cy="32" r={RING_RADIUS} fill="none" strokeWidth="2.5" className="stroke-white/10" />
      )}
      <circle
        cx="32"
        cy="32"
        r={RING_RADIUS}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        // Dashed all the way round when the checks are failing: there is no
        // progress to report, only a broken connection.
        strokeDasharray={isUnreachable ? '3 7' : `${arcLength} ${RING_CIRCUMFERENCE}`}
        transform="rotate(-90 32 32)"
        className={display.strokeClassName}
      />
      <circle
        cx="32"
        cy="32"
        r={RING_RADIUS}
        fill="none"
        stroke="transparent"
        strokeWidth="16"
        style={{ pointerEvents: 'stroke' }}
      />
    </svg>
  );
}

export interface SyncStatusIndicatorProps {
  /** `ring`: arc around an avatar (the base signal). `chip`: labelled pill, the escalation. */
  variant?: 'chip' | 'ring';
  /** Where the details open. Defaults to a sheet for the ring, a popover for the chip. */
  detailsSurface?: 'popover' | 'sheet';
  /** Controlled open state — {@link SyncStatusAvatar} uses it to open on avatar hover. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Mouse handlers for the popover content, so hovering it keeps a controlled popover open. */
  contentMouseHandlers?: Pick<React.ComponentProps<'div'>, 'onMouseEnter' | 'onMouseLeave'>;
  className?: string;
}

/**
 * SyncStatusIndicator
 *
 * Shows whether Nexus has caught up with the user's homeserver content:
 * - yellow: mismatch within the tolerance window (syncing)
 * - orange: mismatch beyond the tolerance window (sync delayed)
 * - red: the checks themselves are failing (can't reach Nexus)
 * - green: brief confirmation right after Nexus catches up
 *
 * The arc around the avatar is the base signal on both platforms; its length is
 * how much of the backlog Nexus has worked through. The labelled chip is an
 * escalation rather than a second treatment: it renders only when Nexus is
 * unreachable, where words in the header are what make the state unmissable.
 * Nothing is rendered while synced (beyond the confirmation) or before the
 * first completed check.
 */
export function SyncStatusIndicator({
  variant = 'chip',
  detailsSurface,
  open,
  onOpenChange,
  contentMouseHandlers,
  className,
}: SyncStatusIndicatorProps) {
  const status = useSyncStatusStore((state) => state.selectSyncStatus());
  const displayStatus = useDisplayStatus(status);
  const progress = useSyncProgress();
  const display = displayStatus ? SYNC_STATUS_CONFIG[displayStatus] : null;
  const surface = detailsSurface ?? (variant === 'ring' ? 'sheet' : 'popover');

  // Only the ring announces. On desktop a ring and a chip can be mounted for
  // the same status, and two live regions would announce it twice; the ring is
  // the one that is always present. It stays mounted even with nothing to show,
  // because a `role="status"` element that appears already populated is not
  // reliably announced — and this way readers also get the "Synced" resolution.
  const liveRegion =
    variant === 'ring' ? (
      <span className="sr-only" role="status" aria-live="polite">
        {display ? display.ariaLabel : ''}
      </span>
    ) : null;

  if (!display || !displayStatus) {
    return liveRegion;
  }

  // The chip is the escalation, not a parallel treatment: the ring carries the
  // quiet states on both platforms, and words appear in the header only when
  // Nexus cannot be reached at all.
  if (variant === 'chip' && displayStatus !== SyncStatus.CHECK_FAILING) {
    return liveRegion;
  }

  const { icon: Icon, spin, label, ariaLabel, chipClassName } = display;
  const triggerProps = {
    'data-cy': 'sync-status-indicator',
    'data-status': displayStatus,
    'data-testid': 'sync-status-indicator',
    'data-variant': variant,
    type: 'button' as const,
    'aria-label': `${ariaLabel}. Show sync details`,
  };

  const trigger =
    variant === 'ring' ? (
      <button {...triggerProps} className={cn('pointer-events-none cursor-pointer', className)}>
        <SyncStatusRing status={displayStatus} display={display} progress={progress} />
      </button>
    ) : (
      <button
        {...triggerProps}
        className={cn(
          'inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors',
          chipClassName,
          className,
        )}
      >
        <Icon aria-hidden className={cn('size-4 shrink-0', spin && 'animate-spin motion-reduce:animate-none')} />
        {label}
      </button>
    );

  const details = <SyncStatusDetails status={displayStatus} display={display} />;

  if (surface === 'sheet') {
    return (
      <>
        {liveRegion}
        <Sheet>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" aria-describedby={undefined} className="rounded-t-xl border-border bg-popover">
            <SheetHeader>
              <SheetTitle className="sr-only">{'Sync status'}</SheetTitle>
            </SheetHeader>
            {details}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <>
      {liveRegion}
      {/* Hover opens it on a pointer device; the atom disables hover on touch. */}
      {/* Uncontrolled: the atom's own hover mode (disabled on touch). Controlled:
          the hover area is the whole avatar, owned by SyncStatusAvatar. */}
      <Popover hover={open === undefined} hoverDelay={150} open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align={variant === 'ring' ? 'end' : 'center'}
          className="w-[280px] p-4"
          {...contentMouseHandlers}
        >
          {details}
        </PopoverContent>
      </Popover>
    </>
  );
}
