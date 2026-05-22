/**
 * General Utility functions for calendar
 * note: put this into a module in the future
 */
import { Temporal } from "temporal-polyfill";

export const Utils = {
  /**
   * Calculates the absolute time difference between two dates in milliseconds.
   * @param {Temporal.PlainDateTime} date1
   * @param {Temporal.PlainDateTime} date2
   * @returns {number}
   */
  calculateIntervalMilliseconds(date1, date2) {
    return Math.abs(
      date1.since(date2).total({ unit: "milliseconds", relativeTo: date1 }),
    );
  },

  /**
   * Calculates the ISO week number for a given date.
   * @param {Temporal.PlainDate} d
   * @returns {number}
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
   * Parses a hex color string into an rgb number triplet. Accepts `#rgb` /
   * `#rrggbb` (with or without leading `#`); returns black for anything it
   * cannot parse.
   * @param {string} color
   * @returns {[number, number, number]}
   */
  getRGB(color) {
    let hex = color.startsWith("#") ? color.substring(1) : color;
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) {
      return [0, 0, 0];
    }
    return [r, g, b];
  },

  /**
   * Picks a readable (black or white) font color for a background color.
   * @param {string} color
   * @returns {"black"|"white"}
   */
  getContrastYIQ(color) {
    const [r, g, b] = this.getRGB(color);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
  },

  /**
   * Darkens/lightens a color by the specified amount -> <1.0 lighten; >1.0 darken
   * @param {string} color
   * @param {number} decimal
   * @returns {string}
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
   * Largest multiple of interval that is less than or equal to target.
   * @param {number} target
   * @param {number} interval
   * @returns {number}
   */
  floorToMultiple(target, interval) {
    if (interval === 0) {
      return 0;
    }

    return Math.floor(target / interval) * interval;
  },

  /**
   * Smallest multiple of interval that is greater than or equal to target.
   * @param {number} target
   * @param {number} interval
   * @returns {number}
   */
  ceilToMultiple(target, interval) {
    if (interval === 0) {
      return 0;
    }

    return Math.ceil(target / interval) * interval;
  },

  /**
   * Converts a date to the `YYYY-MM-DD` string expected by `<input type="date">`.
   * @param {Temporal.PlainDateTime} date
   * @returns {string}
   */
  formatDateForInput(date) {
    return date.toPlainDate().toString();
  },
};
