import { WeekView } from "./WeekView.js";
import { DayView } from "./DayView.js";
import { MonthView } from "./MonthView.js";

/**
 * @typedef {import("./ViewMode").ViewMode} ViewMode
 * @typedef {import("./ResourceCalendar").ResourceCalendarOptions} ResourceCalendarOptions
 */

/**
 * A concrete {@link ViewMode} subclass: its constructor plus the statics
 * every view mode declares.
 * @typedef {{
 *   new (options: ResourceCalendarOptions): ViewMode,
 *   name: string,
 *   buttonAttributes: { iconHtml: string },
 * }} ViewModeConstructor
 */

/**
 * Instantiates a {@link ViewMode} from its string identifier.
 */
export class ViewFactory {
  /**
   * Registered view modes, keyed by each class's static `name`.
   * @type {Record<string, ViewModeConstructor>}
   */
  static MODES = {
    [WeekView.name]: WeekView,
    [MonthView.name]: MonthView,
    [DayView.name]: DayView,
  };

  /**
   * Creates a view mode instance for the given identifier, falling back to
   * {@link WeekView} for unknown identifiers.
   * @param {string} str
   * @param {ResourceCalendarOptions} options
   * @returns {ViewMode}
   */
  static fromString(str, options) {
    const ViewClass = this.MODES[str] || WeekView;
    return new ViewClass(options);
  }
}
