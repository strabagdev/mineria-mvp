"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type SheetPanelProps = {
  titleId: string;
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
  onClose: () => void;
};

export function SheetPanel({
  titleId,
  eyebrow,
  title,
  description,
  className = "",
  children,
  onClose,
}: SheetPanelProps) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function requestClose() {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, 180);
  }

  return (
    <div
      className="modal-backdrop sheet-backdrop"
      data-state={isClosing ? "closed" : "open"}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={`modal-card sheet-card ${className}`.trim()}
        data-state={isClosing ? "closed" : "open"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={titleId} className="card-title" style={{ marginTop: 12 }}>
              {title}
            </h2>
            {description ? (
              <p className="body-copy" style={{ marginTop: 8 }}>
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" className="button" onClick={requestClose}>
            Cerrar
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
