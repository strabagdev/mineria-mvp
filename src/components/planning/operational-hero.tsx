import type { Dispatch, RefObject, SetStateAction } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Moon, Plus, Sun } from "lucide-react";

type ShiftKey = "Dia" | "Noche";

type ShiftConfig = Record<
  ShiftKey,
  {
    title: string;
    description: string;
  }
>;

type OperationalHeroProps = {
  activeShift: ShiftKey;
  onSelectShift: (shift: ShiftKey) => void;
  shiftConfig: ShiftConfig;
  selectedDate: string;
  todayIso: string;
  todayDate: Date;
  calendarMonth: Date;
  calendarDays: Array<Date | null>;
  canGoNextMonth: boolean;
  isDatePickerOpen: boolean;
  setIsDatePickerOpen: Dispatch<SetStateAction<boolean>>;
  setCalendarMonth: Dispatch<SetStateAction<Date>>;
  datePickerRef: RefObject<HTMLDivElement | null>;
  isHistoricalView: boolean;
  isCreateDisabled: boolean;
  createTitle: string;
  formatDateTitle: (value: string) => string;
  formatMonthTitle: (date: Date) => string;
  formatLocalDateIso: (date: Date) => string;
  onSelectOperationalDate: (date: string) => void;
  onCreatePlanning: () => void;
};

function ShiftIcon({ shift }: { shift: ShiftKey }) {
  if (shift === "Dia") {
    return <Sun aria-hidden />;
  }

  return <Moon aria-hidden />;
}

function getNextShift(shift: ShiftKey): ShiftKey {
  return shift === "Dia" ? "Noche" : "Dia";
}

export function OperationalHero({
  activeShift,
  onSelectShift,
  shiftConfig,
  selectedDate,
  todayIso,
  todayDate,
  calendarMonth,
  calendarDays,
  canGoNextMonth,
  isDatePickerOpen,
  setIsDatePickerOpen,
  setCalendarMonth,
  datePickerRef,
  isHistoricalView,
  isCreateDisabled,
  createTitle,
  formatDateTitle,
  formatMonthTitle,
  formatLocalDateIso,
  onSelectOperationalDate,
  onCreatePlanning,
}: OperationalHeroProps) {
  const selectedDateValue = new Date(`${selectedDate}T00:00:00`);
  const isTodaySelected = selectedDate === todayIso;

  function selectRelativeDay(offset: number) {
    const nextDate = new Date(selectedDateValue);
    nextDate.setDate(nextDate.getDate() + offset);

    if (nextDate > todayDate) {
      return;
    }

    onSelectOperationalDate(formatLocalDateIso(nextDate));
  }

  return (
    <article className="surface-card hero hero-operational">
      <div className="hero-operational-line">
        <div className="hero-operational-copy">
          <button
            type="button"
            className="shift-tabs"
            role="switch"
            aria-checked={activeShift === "Noche"}
            aria-label={`Cambiar a ${shiftConfig[getNextShift(activeShift)].title}`}
            title={`Cambiar a ${shiftConfig[getNextShift(activeShift)].title}`}
            onClick={() => onSelectShift(getNextShift(activeShift))}
          >
            {(["Dia", "Noche"] as ShiftKey[]).map((shift) => (
              <span
                key={shift}
                className={`shift-tab ${activeShift === shift ? "active" : ""}`}
                aria-hidden="true"
              >
                <ShiftIcon shift={shift} />
              </span>
            ))}
          </button>
          <h2 className="hero-title">
            <span>Seguimiento operativo del turno</span>
            <span className="hero-title-separator" aria-hidden="true">
              -
            </span>
            <span className="hero-shift-window">{shiftConfig[activeShift].description}</span>
          </h2>
        </div>

        <div className="history-controls" aria-label="Selector de fecha" ref={datePickerRef}>
          <button
            type="button"
            className="button icon-button date-selector-nav"
            onClick={() => selectRelativeDay(-1)}
            aria-label="Dia anterior"
            title="Dia anterior"
          >
            <ChevronLeft aria-hidden />
          </button>

          <div className="date-picker-shell">
            <button
              type="button"
              className={`date-display-button ${isDatePickerOpen ? "active" : ""}`}
              aria-haspopup="dialog"
              aria-expanded={isDatePickerOpen}
              onClick={() => setIsDatePickerOpen((current) => !current)}
            >
              <span className="history-control-icon" aria-hidden="true">
                <CalendarDays aria-hidden />
              </span>
              <span className="date-display-copy">
                <span className="date-display-value">{formatDateTitle(selectedDate)}</span>
              </span>
            </button>

            {isDatePickerOpen ? (
              <div className="date-picker-popover" role="dialog" aria-label="Seleccionar fecha operacional">
                <div className="date-picker-header">
                  <button
                    type="button"
                    className="button icon-button date-picker-nav"
                    onClick={() =>
                      setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                    }
                    aria-label="Mes anterior"
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                  <p className="date-picker-month">{formatMonthTitle(calendarMonth)}</p>
                  <button
                    type="button"
                    className="button icon-button date-picker-nav"
                    disabled={!canGoNextMonth}
                    onClick={() =>
                      setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                    }
                    aria-label="Mes siguiente"
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                </div>

                <div className="date-picker-weekdays" aria-hidden="true">
                  {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                    <span key={`${day}-${index}`}>{day}</span>
                  ))}
                </div>

                <div className="date-picker-grid">
                  {calendarDays.map((date, index) => {
                    if (!date) {
                      return <span key={`empty-${index}`} aria-hidden="true" />;
                    }

                    const dateIso = formatLocalDateIso(date);
                    const isSelected = dateIso === selectedDate;
                    const isToday = dateIso === todayIso;
                    const isFuture = date > todayDate;

                    return (
                      <button
                        key={dateIso}
                        type="button"
                        className={[
                          "date-picker-day",
                          isSelected ? "selected" : "",
                          isToday ? "today" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={isFuture}
                        onClick={() => onSelectOperationalDate(dateIso)}
                        aria-pressed={isSelected}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>

                <div className="date-picker-footer">
                  <button type="button" className="button date-picker-today" onClick={() => onSelectOperationalDate(todayIso)}>
                    Volver a hoy
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="button icon-button date-selector-nav"
            onClick={() => selectRelativeDay(1)}
            disabled={isTodaySelected}
            aria-label="Dia siguiente"
            title="Dia siguiente"
          >
            <ChevronRight aria-hidden />
          </button>

          <button
            type="button"
            className="button date-selector-today"
            onClick={() => onSelectOperationalDate(todayIso)}
            disabled={!isHistoricalView && isTodaySelected}
          >
            Hoy
          </button>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="button primary hero-action-button"
            onClick={onCreatePlanning}
            disabled={isCreateDisabled}
            aria-label="Nueva programacion"
            title={createTitle}
          >
            <Plus aria-hidden />
            <span>Nueva programacion</span>
          </button>
        </div>
      </div>
    </article>
  );
}
