"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipPosition = {
  left: number;
  top: number;
  placement: "above" | "below";
  maxWidth: number;
};

type GanttTooltipPortalProps = {
  children: ReactNode;
};

const VIEWPORT_MARGIN = 12;
const TOOLTIP_GAP = 8;
const DEFAULT_TOOLTIP_WIDTH = 288;
const DEFAULT_TOOLTIP_HEIGHT = 132;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function GanttTooltipPortal({ children }: GanttTooltipPortalProps) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({
    left: 0,
    top: 0,
    placement: "above",
    maxWidth: DEFAULT_TOOLTIP_WIDTH,
  });

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setVisible(false), 90);
  }, [clearHideTimer]);

  const updatePosition = useCallback(() => {
    const bar = anchorRef.current?.closest(".gantt-bar");

    if (!(bar instanceof HTMLElement)) {
      return;
    }

    const rect = bar.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.min(DEFAULT_TOOLTIP_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
    const tooltipWidth = tooltipRef.current?.offsetWidth || maxWidth;
    const tooltipHeight = tooltipRef.current?.offsetHeight || DEFAULT_TOOLTIP_HEIGHT;
    const centerLeft = rect.left + rect.width / 2;
    const left = clamp(
      centerLeft,
      VIEWPORT_MARGIN + tooltipWidth / 2,
      viewportWidth - VIEWPORT_MARGIN - tooltipWidth / 2
    );
    const canShowAbove = rect.top - tooltipHeight - TOOLTIP_GAP >= VIEWPORT_MARGIN;
    const top = canShowAbove
      ? rect.top - tooltipHeight - TOOLTIP_GAP
      : clamp(rect.bottom + TOOLTIP_GAP, VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN - tooltipHeight);

    setPosition({
      left,
      top,
      placement: canShowAbove ? "above" : "below",
      maxWidth,
    });
  }, []);

  const show = useCallback(() => {
    clearHideTimer();
    updatePosition();
    setVisible(true);
    requestAnimationFrame(updatePosition);
  }, [clearHideTimer, updatePosition]);

  useEffect(() => {
    setMounted(true);
    return () => clearHideTimer();
  }, [clearHideTimer]);

  useEffect(() => {
    const bar = anchorRef.current?.closest(".gantt-bar");

    if (!(bar instanceof HTMLElement)) {
      return;
    }

    bar.addEventListener("pointerenter", show);
    bar.addEventListener("pointerleave", scheduleHide);
    bar.addEventListener("focusin", show);
    bar.addEventListener("focusout", scheduleHide);

    return () => {
      bar.removeEventListener("pointerenter", show);
      bar.removeEventListener("pointerleave", scheduleHide);
      bar.removeEventListener("focusin", show);
      bar.removeEventListener("focusout", scheduleHide);
    };
  }, [scheduleHide, show]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition, visible]);

  return (
    <>
      <span ref={anchorRef} className="gantt-tooltip-anchor" aria-hidden="true" />
      {mounted && visible
        ? createPortal(
            <span
              ref={tooltipRef}
              className={`gantt-bar-tooltip portal ${position.placement}`}
              role="tooltip"
              style={{
                left: position.left,
                top: position.top,
                maxWidth: position.maxWidth,
              }}
              onPointerEnter={show}
              onPointerLeave={scheduleHide}
            >
              {children}
            </span>,
            document.body
          )
        : null}
    </>
  );
}
