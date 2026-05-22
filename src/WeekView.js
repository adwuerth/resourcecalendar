import { Temporal } from "temporal-polyfill";
import { ViewMode } from "./ViewMode";
import iconCalendarWeek from "./assets/calendar-week.svg?raw";
import { Utils } from "./utils";

/**
 * @typedef {import("./ResourceCalendar").ResourceCalendarOptions} ResourceCalendarOptions
 */

/**
 * Week view: one column per day, Monday to Sunday (or Friday when weekends
 * are disabled).
 */
export class WeekView extends ViewMode {
  /** @type {string} */
  static name = "week";
  /** @type {{ iconHtml: string }} */
  static buttonAttributes = {
    iconHtml: iconCalendarWeek,
  };

  /**
   * @param {ResourceCalendarOptions} options
   */
  constructor(options) {
    super(WeekView.name, options);
  }

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {string}
   */
  formatDate(date) {
    /** @type {Intl.DateTimeFormatOptions} */
    const options = {
      weekday: "short",
      month: "long",
      day: "numeric",
    };

    return date.toLocaleString(this.locale, options);
  }

  /**
   * Advances the given date by a number of weeks.
   * @param {Temporal.PlainDateTime} date
   * @param {number} by
   * @returns {Temporal.PlainDateTime}
   */
  advanceBy(date, by) {
    return date.add({ weeks: by });
  }

  /**
   * Gets the dates for the week containing the given date, starting from
   * Monday and ending on Sunday (or Friday when weekends are disabled).
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime[]}
   */
  getDates(date = Temporal.Now.plainDateTimeISO()) {
    const monday = this.getStartDate(date);

    const weekDates = [];
    const dayCount = this.weekends ? 7 : 5;

    for (let i = 0; i < dayCount; i++) {
      weekDates.push(monday.add({ days: i }));
    }

    return weekDates;
  }

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime}
   */
  getStartDate(date) {
    // Temporal.dayOfWeek: 1=Monday ... 7=Sunday
    const daysToMonday = -(date.dayOfWeek - 1);

    return date
      .toPlainDate()
      .add({ days: daysToMonday })
      .toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
  }

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime}
   */
  getEndDate(date) {
    let endDate = super.getEndDate(date);
    if (!this.weekends) {
      endDate = endDate.add({ days: -2 });
    }
    return endDate;
  }

  /**
   * Whether both dates fall on the same calendar day.
   * @param {Temporal.PlainDateTime} date1
   * @param {Temporal.PlainDateTime} date2
   * @returns {boolean}
   */
  equalsUnit(date1, date2) {
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

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {string}
   */
  header(date) {
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
