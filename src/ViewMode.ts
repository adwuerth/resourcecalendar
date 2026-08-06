import { Temporal } from "temporal-polyfill";
import type { ResourceCalendarOptions } from "./ResourceCalendar";

/**
 * ViewMode determines the table's date layout, formatting etc. It is an
 * abstract base class; concrete view modes (day/week/month) subclass it and
 * must implement every method that throws here.
 *
 * Not declared `abstract`: the runtime guard in the constructor has to hold
 * for plain-JS consumers too, who get no compile-time check.
 */
export class ViewMode {
  static DEFAULT_LOCALE = "en-US";

  /** the view mode's identifier (e.g. `"week"`) */
  name: string;
  subdivision: number;
  locale: string;
  weekends: boolean;

  constructor(name: string, options: ResourceCalendarOptions) {
    if (this.constructor === ViewMode) {
      throw new Error("Abstract class ViewMode cannot be instantiated.");
    }
    this.name = name;
    this.subdivision = options.subdivision[name] ?? 1;
    this.locale = options.locale ?? ViewMode.DEFAULT_LOCALE;
    this.weekends = options.weekends ?? true;
  }

  /**
   * Formats a single column header date.
   */
  formatDate(date: Temporal.PlainDateTime): string {
    throw new Error("ViewMode.formatDate must be implemented by a subclass.");
  }

  /**
   * Advances a date by `by` units of this view mode (days/weeks/months).
   */
  advanceBy(date: Temporal.PlainDateTime, by: number): Temporal.PlainDateTime {
    throw new Error("ViewMode.advanceBy must be implemented by a subclass.");
  }

  /**
   * Returns the ordered list of column dates for the view containing `date`.
   */
  getDates(date: Temporal.PlainDateTime): Temporal.PlainDateTime[] {
    throw new Error("ViewMode.getDates must be implemented by a subclass.");
  }

  /**
   * Returns the inclusive start date of the view containing `date`.
   */
  getStartDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    throw new Error("ViewMode.getStartDate must be implemented by a subclass.");
  }

  /**
   * Returns the exclusive end date of the view containing `date`.
   */
  getEndDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    return this.advanceBy(this.getStartDate(date), 1);
  }

  /**
   * Whether two dates fall in the same unit for this view mode (e.g. the
   * same day for week view, the same hour for day view).
   */
  equalsUnit(
    date1: Temporal.PlainDateTime,
    date2: Temporal.PlainDateTime,
  ): boolean {
    throw new Error("ViewMode.equalsUnit must be implemented by a subclass.");
  }

  /**
   * Renders the toolbar header text for the view containing `date`.
   */
  header(date: Temporal.PlainDateTime): string {
    throw new Error("ViewMode.header must be implemented by a subclass.");
  }
}
