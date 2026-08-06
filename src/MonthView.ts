import { Temporal } from "temporal-polyfill";
import { ViewMode } from "./ViewMode";
import type { ResourceCalendarOptions } from "./ResourceCalendar";
import iconCalendarMonth from "./assets/calendar.svg?raw";

/**
 * Month view: one column per day of a single calendar month.
 */
export class MonthView extends ViewMode {
  static name = "month";
  static buttonAttributes: { iconHtml: string } = {
    iconHtml: iconCalendarMonth,
  };

  constructor(options: ResourceCalendarOptions) {
    super(MonthView.name, options);
  }

  formatDate(date: Temporal.PlainDateTime): string {
    let formattedDate = date.toLocaleString(this.locale, {
      weekday: "short",
      day: "2-digit",
    });

    formattedDate = formattedDate.replace(/,\s*/, " ");
    formattedDate = formattedDate.replace(/\.$/, "");

    return formattedDate;
  }

  /**
   * Advances the given date by a number of months.
   */
  advanceBy(date: Temporal.PlainDateTime, by: number): Temporal.PlainDateTime {
    return date.add({ months: by });
  }

  /**
   * Gets the dates for every day of the month containing the given date.
   */
  getDates(
    date: Temporal.PlainDateTime = Temporal.Now.plainDateTimeISO(),
  ): Temporal.PlainDateTime[] {
    const dates = [];
    let current = Temporal.PlainDate.from({
      year: date.year,
      month: date.month,
      day: 1,
    }).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));

    while (current.month === date.month) {
      dates.push(current);
      current = current.add({ days: 1 });
    }

    return dates;
  }

  getStartDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    return Temporal.PlainDate.from({
      year: date.year,
      month: date.month,
      day: 1,
    }).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
  }

  /**
   * Whether both dates fall on the same calendar day.
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
      date1.day === date2.day
    );
  }

  header(date: Temporal.PlainDateTime): string {
    return date.toLocaleString(this.locale, {
      month: "long",
      year: "numeric",
    });
  }
}
