import { Temporal } from "temporal-polyfill";
import { ViewMode } from "./ViewMode";
import iconCalendarMonth from "./assets/calendar.svg?raw";

/**
 * @typedef {import("./ResourceCalendar").ResourceCalendarOptions} ResourceCalendarOptions
 */

/**
 * Month view: one column per day of a single calendar month.
 */
export class MonthView extends ViewMode {
  /** @type {string} */
  static name = "month";
  /** @type {{ iconHtml: string }} */
  static buttonAttributes = {
    iconHtml: iconCalendarMonth,
  };

  /**
   * @param {ResourceCalendarOptions} options
   */
  constructor(options) {
    super(MonthView.name, options);
  }

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {string}
   */
  formatDate(date) {
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
   * @param {Temporal.PlainDateTime} date
   * @param {number} by
   * @returns {Temporal.PlainDateTime}
   */
  advanceBy(date, by) {
    return date.add({ months: by });
  }

  /**
   * Gets the dates for every day of the month containing the given date.
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime[]}
   */
  getDates(date = Temporal.Now.plainDateTimeISO()) {
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

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime}
   */
  getStartDate(date) {
    return Temporal.PlainDate.from({
      year: date.year,
      month: date.month,
      day: 1,
    }).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
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
    return date.toLocaleString(this.locale, {
      month: "long",
      year: "numeric",
    });
  }
}
