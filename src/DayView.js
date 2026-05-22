import { Temporal } from "temporal-polyfill";
import { ViewMode } from "./ViewMode";
import iconCalendarDay from "./assets/calendar-day.svg?raw";

/**
 * @typedef {import("./ResourceCalendar").ResourceCalendarOptions} ResourceCalendarOptions
 */

/**
 * Day view: one column per hour of a single day.
 */
export class DayView extends ViewMode {
  /** @type {string} */
  static name = "day";
  /** @type {{ iconHtml: string }} */
  static buttonAttributes = {
    iconHtml: iconCalendarDay,
  };

  /**
   * @param {ResourceCalendarOptions} options
   */
  constructor(options) {
    super(DayView.name, options);
  }

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {string}
   */
  formatDate(date) {
    return date.toLocaleString(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Advances the given date by a number of days.
   * @param {Temporal.PlainDateTime} date
   * @param {number} by
   * @returns {Temporal.PlainDateTime}
   */
  advanceBy(date, by) {
    return date.add({ days: by });
  }

  /**
   * Gets an array of 24 dates representing each hour of the day for the given
   * date. Each entry is set to the start of that hour (00:00, 01:00, ...).
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime[]}
   */
  getDates(date = Temporal.Now.plainDateTimeISO()) {
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

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime}
   */
  getStartDate(date) {
    return Temporal.PlainDate.from({
      year: date.year,
      month: date.month,
      day: date.day,
    }).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
  }

  /**
   * Whether both dates fall in the same hour of the same day.
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
      date1.day === date2.day &&
      date1.hour === date2.hour
    );
  }

  /**
   * @param {Temporal.PlainDateTime} date
   * @returns {string}
   */
  header(date) {
    return date.toLocaleString(this.locale);
  }
}
