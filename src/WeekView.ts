import { Temporal } from "temporal-polyfill";
import { ViewMode } from "./ViewMode";
import type { ResourceCalendarOptions } from "./ResourceCalendar";
import iconCalendarWeek from "./assets/calendar-week.svg?raw";
import { Utils } from "./utils";

/**
 * Week view: one column per day, Monday to Sunday (or Friday when weekends
 * are disabled).
 */
export class WeekView extends ViewMode {
  static name = "week";
  static buttonAttributes: { iconHtml: string } = {
    iconHtml: iconCalendarWeek,
  };

  constructor(options: ResourceCalendarOptions) {
    super(WeekView.name, options);
  }

  formatDate(date: Temporal.PlainDateTime): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "long",
      day: "numeric",
    };

    return date.toLocaleString(this.locale, options);
  }

  /**
   * Advances the given date by a number of weeks.
   */
  advanceBy(date: Temporal.PlainDateTime, by: number): Temporal.PlainDateTime {
    return date.add({ weeks: by });
  }

  /**
   * Gets the dates for the week containing the given date, starting from
   * Monday and ending on Sunday (or Friday when weekends are disabled).
   */
  getDates(
    date: Temporal.PlainDateTime = Temporal.Now.plainDateTimeISO(),
  ): Temporal.PlainDateTime[] {
    const monday = this.getStartDate(date);

    const weekDates = [];
    const dayCount = this.weekends ? 7 : 5;

    for (let i = 0; i < dayCount; i++) {
      weekDates.push(monday.add({ days: i }));
    }

    return weekDates;
  }

  getStartDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    // Temporal.dayOfWeek: 1=Monday ... 7=Sunday
    const daysToMonday = -(date.dayOfWeek - 1);

    return date
      .toPlainDate()
      .add({ days: daysToMonday })
      .toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
  }

  getEndDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    let endDate = super.getEndDate(date);
    if (!this.weekends) {
      endDate = endDate.add({ days: -2 });
    }
    return endDate;
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
    const startDate = this.getStartDate(date);
    const endDate = this.getEndDate(date);

    const startFormatted = startDate.toLocaleString(this.locale, {
      day: "2-digit",
      month: "2-digit",
    });
    const endFormatted = endDate.toLocaleString(this.locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const calendarWeek = Utils.getWeekNumber(date.toPlainDate());

    return `KW ${calendarWeek}: ${startFormatted} - ${endFormatted}`;
  }
}
