'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice/useIsTouchDevice';
import { cn } from '@/libs/utils/utils';
import { SyncStatusIndicator } from './SyncStatusIndicator';

/** Grace period so the pointer can travel from the avatar into the popover */
const HOVER_CLOSE_DELAY_MS = 150;

export interface SyncStatusAvatarProps {
  /** The avatar (usually a link to the profile) the ring is drawn around */
  children: React.ReactNode;
  /** Where the details open: a popover on desktop, a bottom sheet on touch. */
  detailsSurface?: 'popover' | 'sheet';
  className?: string;
}

/**
 * Wraps an avatar with the sync ring and makes the *whole avatar* the hover
 * area for the details popover.
 *
 * The ring's own hit area is only its 12px band — precise enough for a
 * deliberate tap, far too fiddly to hover with a mouse. Hover therefore lives
 * on this wrapper while the click targets stay separate: clicking the avatar
 * still opens the profile, clicking the ring band opens the details.
 */
export function SyncStatusAvatar({ children, detailsSurface = 'popover', className }: SyncStatusAvatarProps) {
  const isTouchDevice = useIsTouchDevice();
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverEnabled = detailsSurface === 'popover' && !isTouchDevice;

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => cancelClose, [cancelClose]);

  const handleEnter = useCallback(() => {
    if (!hoverEnabled) return;
    cancelClose();
    setOpen(true);
  }, [cancelClose, hoverEnabled]);

  const handleLeave = useCallback(() => {
    if (!hoverEnabled) return;
    cancelClose();
    closeTimeoutRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [cancelClose, hoverEnabled]);

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      data-testid="sync-status-avatar"
    >
      {children}
      <SyncStatusIndicator
        variant="ring"
        detailsSurface={detailsSurface}
        className="absolute -inset-2"
        {...(hoverEnabled
          ? {
              open,
              onOpenChange: setOpen,
              contentMouseHandlers: { onMouseEnter: handleEnter, onMouseLeave: handleLeave },
            }
          : {})}
      />
    </span>
  );
}
