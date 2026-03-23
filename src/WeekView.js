import { ViewMode } from "./ViewMode";
import iconCalendarWeek from "./assets/calendar-week.svg?raw";
import { Utils } from "./utils";

export class WeekView extends ViewMode {
  static name = "week";
  static buttonAttributes = {
    iconHtml: iconCalendarWeek,
  };

  constructor(options) {
    super(WeekView.name, options);
  }

  formatDate(date) {
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
   * Gets an array of Temporal.PlainDateTime objects for the week containing the given date,
   * starting from Monday and ending on Sunday.
   * @param {Temporal.PlainDateTime} date
   * @returns {Array<Temporal.PlainDateTime>}
   */
  getDates(date = Temporal.Now.plainDateISO()) {
    const monday = this.getStartDate(date);

    const weekDates = [];
    const dayCount = this.weekends ? 7 : 5;

    for (let i = 0; i < dayCount; i++) {
      weekDates.push(monday.add({ days: i }));
    }

    return weekDates;
  }

  getStartDate(date) {
    // Temporal.dayOfWeek: 1=Monday ... 7=Sunday
    const daysToMonday = -(date.dayOfWeek - 1);

    return date
      .toPlainDate()
      .add({ days: daysToMonday })
      .toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
  }

  getEndDate(date) {
    let endDate = super.getEndDate(date);
    if (!this.weekends) {
      endDate = endDate.add({ days: -2 });
    }
    return endDate;
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
