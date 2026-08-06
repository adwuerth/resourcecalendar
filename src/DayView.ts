import { Temporal } from "temporal-polyfill";
import { ViewMode } from "./ViewMode";
import type { ResourceCalendarOptions } from "./ResourceCalendar";
import iconCalendarDay from "./assets/calendar-day.svg?raw";

/**
 * Day view: one column per hour of a single day.
 */
export class DayView extends ViewMode {
  static name = "day";
  static buttonAttributes: { iconHtml: string } = {
    iconHtml: iconCalendarDay,
  };

  constructor(options: ResourceCalendarOptions) {
    super(DayView.name, options);
  }

  formatDate(date: Temporal.PlainDateTime): string {
    return date.toLocaleString(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Advances the given date by a number of days.
   */
  advanceBy(date: Temporal.PlainDateTime, by: number): Temporal.PlainDateTime {
    return date.add({ days: by });
  }

  /**
   * Gets an array of 24 dates representing each hour of the day for the given
   * date. Each entry is set to the start of that hour (00:00, 01:00, ...).
   */
  getDates(
    date: Temporal.PlainDateTime = Temporal.Now.plainDateTimeISO(),
  ): Temporal.PlainDateTime[] {
    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(
        Temporal.PlainDate.from({
          year: date.year,
          month: date.month,
          day: date.day,
        }).toPlainDateTime(
          Temporal.PlainTime.from({ hour: i, minute: 0, second: 0 }),
        ),
      );
    }
    return hours;
  }

  getStartDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    return Temporal.PlainDate.from({
      year: date.year,
      month: date.month,
      day: date.day,
    }).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
  }

  /**
   * Whether both dates fall in the same hour of the same day.
   */
  equalsUnit(
    date1: Temporal.PlainDateTime,
    date2: Temporal.PlainDateTime,
  ): boolean {
    if (
      !(date1 instanceof Temporal.PlainDateTime) ||
      !(date2 instanceof Temporal.PlainDateTime)
    ) {
      return false;
    }

    return (
      date1.year === date2.year &&
      date1.month === date2.month &&
      date1.day === date2.day &&
      date1.hour === date2.hour
    );
  }

  header(date: Temporal.PlainDateTime): string {
    return date.toLocaleString(this.locale);
  }
}
