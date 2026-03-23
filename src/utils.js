/**
 * General Utility functions for calendar
 * note: put this into a module in the future
 */
export const Utils = {
  /**
   * Calculates the absolute time difference between two dates in milliseconds.
   * @returns {number}
   * @param {Temporal.PlainDateTime} date1
   * @param {Temporal.PlainDateTime} date2
   */
  calculateIntervalMilliseconds(date1, date2) {
    return Math.abs(
      date1.since(date2).total({ unit: "milliseconds", relativeTo: date1 }),
    );
  },

  /**
   * Calculates week number for a given date.
   * @param {Temporal.PlainDate} d
   * @return {number}
   */
  getWeekNumber(d) {
    const thursday = d.add({ days: 4 - (d.dayOfWeek === 7 ? 7 : d.dayOfWeek) });
    const yearStart = Temporal.PlainDate.from({
      year: thursday.year,
      month: 1,
      day: 1,
    });
    return Math.ceil(
      (thursday
        .since(yearStart)
        .total({ unit: "days", relativeTo: yearStart }) +
        1) /
        7,
    );
  },

  /**
   * hex color string to rgb number array
   * @param color
   * @return {number[]}
   */
  getRGB(color) {
    color = color.startsWith("#") ? color.substring(1) : color;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return [r, g, b];
  },

  /**
   * get white or black font color for background color
   * @param color
   * @return {string}
   */
  getContrastYIQ(color) {
    const [r, g, b] = this.getRGB(color);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
  },

  /**
   * darken/lighten color by specified amount -> <1.0 lighten; >1.0 darken
   * @param color
   * @param decimal
   * @return {string}
   */
  shadeColor(color, decimal) {
    return `#${this.getRGB(color)
      .map((n) =>
        Math.min(Math.round(n / decimal), 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  },

  /**
   * find the highest multiple of interval that is smaller than target
   * @param target
   * @param interval
   * @return {number}
   */
  findSmallestEquidistantValue(target, interval) {
    if (interval === 0) {
      return 0;
    }

    const roundedQuotient = Math.floor(target / interval);
    return roundedQuotient * interval;
  },

  /**
   * find the smallest multiple of interval that is bigger than target
   * @param target
   * @param interval
   * @return {number}
   */
  findBiggestEquidistantValue(target, interval) {
    if (interval === 0) {
      return 0;
    }

    const roundedQuotient = Math.ceil(target / interval);
    return roundedQuotient * interval;
  },

  /**
   * convert Temporal.PlainDate object to string for type date input
   * @param {Temporal.PlainDate} date
   * @return {string}
   */
  formatDateForInput(date) {
    return date.toPlainDate().toString();
  },
};
