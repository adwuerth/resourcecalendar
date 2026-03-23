import { ViewMode } from "./ViewMode";
import iconCalendarDay from "./assets/calendar-day.svg?raw";

export class DayView extends ViewMode {
  static name = "day";
  static buttonAttributes = {
    iconHtml: iconCalendarDay,
  };

  constructor(options) {
    super(DayView.name, options);
  }

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
   * Gets an array of 24 Date objects representing each hour of the day for the given date.
   * Each Date object will be set to the start of that hour (e.g., 00:00, 01:00, ..., 23:00).
   * @param {Date} date
   * @returns {Array<Date>}
   */
  getDates(date = Temporal.Now.plainDateISO()) {
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

  getStartDate(date) {
    return Temporal.PlainDate.from({
      year: date.year,
      month: date.month,
      day: date.day,
    }).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
  }

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

  header(date) {
    return date.toLocaleString(this.locale);
  }
}
