import { ViewMode } from "./ViewMode";
import iconCalendarMonth from "./assets/calendar.svg?raw";

export class MonthView extends ViewMode {
  static name = "month";
  static buttonAttributes = {
    iconHtml: iconCalendarMonth,
  };

  constructor(options) {
    super(MonthView.name, options);
  }

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
   * Gets an array of Temporal.PlainDateTime objects for the month containing the given date
   * @param {Temporal.PlainDateTime} date
   * @returns {Array<Temporal.PlainDateTime>}
   */
  getDates(date = Temporal.Now.plainDateISO()) {
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

  getStartDate(date) {
    return Temporal.PlainDate.from({
      year: date.year,
      month: date.month,
      day: 1,
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
      date1.day === date2.day
    );
  }

  header(date) {
    return date.toLocaleString(this.locale, {
      month: "long",
      year: "numeric",
    });
  }
}
