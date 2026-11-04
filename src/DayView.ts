import { Temporal } from "temporal-polyfill";
import { ViewMode } from "./ViewMode";
import type { ResourceCalendarOptions } from "./ResourceCalendar";
import iconCalendarDay from "./assets/calendar-day.svg?raw";
import { Utils } from "./utils";

/**
 * Day view: one column per hour of a single day.
 */
export class DayView extends ViewMode {
  static name = "day";
  static buttonAttributes: { iconHtml: string } = {
    iconHtml: iconCalendarDay,
  };

  /** first visible minute of the day */
  minMinutes: number;
  /** visible hours, i.e. number of columns before subdivision */
  hourCount: number;

  constructor(options: ResourceCalendarOptions) {
    super(DayView.name, options);

    let min = Utils.parseTimeOfDay(options.minTime);
    let max = Utils.parseTimeOfDay(options.maxTime);
    if (min === null || max === null || min >= max) {
      console.warn(
        `ResourceCalendar: invalid minTime/maxTime "${options.minTime}"/"${options.maxTime}", showing the whole day.`,
      );
      min = 0;
      max = 24 * 60;
    }
    this.minMinutes = min;
    // a partial last hour still gets a whole column
    this.hourCount = Math.ceil((max - min) / 60);
  }

  formatDate(date: Temporal.PlainDateTime): string {
    return date.toLocaleString(this.locale, {
      hour: "numeric",
      minute: this.minMinutes % 60 ? "2-digit" : undefined,
    });
  }

  /**
   * Advances the given date by a number of days.
   */
  advanceBy(date: Temporal.PlainDateTime, by: number): Temporal.PlainDateTime {
    return date.add({ days: by });
  }

  /**
   * One date per visible hour, from `minTime` up to `maxTime`.
   */
  getDates(
    date: Temporal.PlainDateTime = Temporal.Now.plainDateTimeISO(),
  ): Temporal.PlainDateTime[] {
    const start = this.getStartDate(date);
    const hours = [];
    for (let i = 0; i < this.hourCount; i++) {
      hours.push(start.add({ hours: i }));
    }
    return hours;
  }

  /**
   * The given day at `minTime`.
   */
  getStartDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    return date
      .toPlainDate()
      .toPlainDateTime()
      .add({ minutes: this.minMinutes });
  }

  /**
   * The end of the last visible hour column (`maxTime`, rounded up to a whole
   * hour after `minTime`).
   */
  getEndDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    return this.getStartDate(date).add({ hours: this.hourCount });
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
