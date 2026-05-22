import { Temporal } from "temporal-polyfill";

/**
 * @typedef {import("./ResourceCalendar").ResourceCalendarOptions} ResourceCalendarOptions
 */

/**
 * ViewMode determines the table's date layout, formatting etc. It is an
 * abstract base class; concrete view modes (day/week/month) subclass it and
 * must implement every method that throws here.
 */
export class ViewMode {
  /** @type {string} */
  static DEFAULT_LOCALE = "en-US";

  /**
   * @param {string} name - the view mode's identifier (e.g. `"week"`)
   * @param {ResourceCalendarOptions} options
   */
  constructor(name, options) {
    if (this.constructor === ViewMode) {
      throw new Error("Abstract class ViewMode cannot be instantiated.");
    }
    /** @type {string} */
    this.name = name;
    /** @type {number} */
    this.subdivision = options.subdivision[name] ?? 1;
    /** @type {string} */
    this.locale = options.locale ?? ViewMode.DEFAULT_LOCALE;
    /** @type {boolean} */
    this.weekends = options.weekends ?? true;
  }

  /**
   * Formats a single column header date.
   * @param {Temporal.PlainDateTime} date
   * @returns {string}
   */
  formatDate(date) {
    throw new Error("ViewMode.formatDate must be implemented by a subclass.");
  }

  /**
   * Advances a date by `by` units of this view mode (days/weeks/months).
   * @param {Temporal.PlainDateTime} date
   * @param {number} by
   * @returns {Temporal.PlainDateTime}
   */
  advanceBy(date, by) {
    throw new Error("ViewMode.advanceBy must be implemented by a subclass.");
  }

  /**
   * Returns the ordered list of column dates for the view containing `date`.
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime[]}
   */
  getDates(date) {
    throw new Error("ViewMode.getDates must be implemented by a subclass.");
  }

  /**
   * Returns the inclusive start date of the view containing `date`.
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime}
   */
  getStartDate(date) {
    throw new Error("ViewMode.getStartDate must be implemented by a subclass.");
  }

  /**
   * Returns the exclusive end date of the view containing `date`.
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime}
   */
  getEndDate(date) {
    return this.advanceBy(this.getStartDate(date), 1);
  }

  /**
   * Whether two dates fall in the same unit for this view mode (e.g. the
   * same day for week view, the same hour for day view).
   * @param {Temporal.PlainDateTime} date1
   * @param {Temporal.PlainDateTime} date2
   * @returns {boolean}
   */
  equalsUnit(date1, date2) {
    throw new Error("ViewMode.equalsUnit must be implemented by a subclass.");
  }

  /**
   * Renders the toolbar header text for the view containing `date`.
   * @param {Temporal.PlainDateTime} date
   * @returns {string}
   */
  header(date) {
    throw new Error("ViewMode.header must be implemented by a subclass.");
  }
}
