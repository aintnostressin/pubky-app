'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import type * as React from 'react';
import { cn } from '@/libs/utils/utils';
import { useSyncStatusStore } from '@/stores/syncStatus/syncStatus.store';
import { SyncStatus } from '@/stores/syncStatus/syncStatus.types';

type BehindStatus = SyncStatus.OUT_OF_SYNC | SyncStatus.OUT_OF_SYNC_STALE;

const SYNC_STATUS_CONFIG: Record<
  BehindStatus,
  {
    label: string;
    ariaLabel: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    spin: boolean;
    chipClassName: string;
    dotClassName: string;
  }
> = {
  [SyncStatus.OUT_OF_SYNC]: {
    label: 'Syncing',
    ariaLabel: 'Syncing with Pubky Nexus',
    icon: RefreshCw,
    spin: true,
    chipClassName: 'bg-yellow-500/15 text-yellow-500',
    dotClassName: 'bg-yellow-500',
  },
  [SyncStatus.OUT_OF_SYNC_STALE]: {
    label: 'Not syncing',
    ariaLabel: 'Not syncing with Pubky Nexus',
    icon: TriangleAlert,
    spin: false,
    chipClassName: 'bg-red-500/15 text-red-500',
    dotClassName: 'bg-red-500',
  },
};

const isBehind = (status: SyncStatus): status is BehindStatus =>
  status === SyncStatus.OUT_OF_SYNC || status === SyncStatus.OUT_OF_SYNC_STALE;

export interface SyncStatusIndicatorProps {
  /** `chip`: labelled pill for the header row. `dot`: bare dot for the mobile footer avatar. */
  variant?: 'chip' | 'dot';
  className?: string;
}

/**
 * SyncStatusIndicator
 *
 * Shows how far Nexus is behind the user's homeserver content. It only appears
 * when Nexus is behind:
 * - yellow: mismatch within the tolerance window (syncing)
 * - red: mismatch beyond the tolerance window (not syncing)
 *
 * Nothing is rendered while synced or before the first completed comparison.
 */
export function SyncStatusIndicator({ variant = 'chip', className }: SyncStatusIndicatorProps) {
  const status = useSyncStatusStore((state) => state.selectSyncStatus());

  if (!isBehind(status)) {
    return null;
  }

  const { label, ariaLabel, icon: Icon, spin, chipClassName, dotClassName } = SYNC_STATUS_CONFIG[status];
  const sharedProps = {
    'data-cy': 'sync-status-indicator',
    'data-status': status,
    'data-testid': 'sync-status-indicator',
    'data-variant': variant,
    role: 'status',
    'aria-label': ariaLabel,
    title: ariaLabel,
  };

  if (variant === 'dot') {
    return (
      <span
        {...sharedProps}
        className={cn('pointer-events-none size-2.5 rounded-full ring-2 ring-(--background)', dotClassName, className)}
      />
    );
  }

  return (
    <span
      {...sharedProps}
      className={cn(
        'inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium',
        chipClassName,
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-4 shrink-0', spin && 'animate-spin')} />
      {label}
    </span>
  );
}
