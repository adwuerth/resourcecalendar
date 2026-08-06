import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { MonthView } from "./MonthView";
import type { ViewMode } from "./ViewMode";
import type { ResourceCalendarOptions } from "./ResourceCalendar";

/**
 * A concrete {@link ViewMode} subclass: its constructor plus the statics
 * every view mode declares.
 */
export type ViewModeConstructor = {
  new (options: ResourceCalendarOptions): ViewMode;
  name: string;
  buttonAttributes: { iconHtml: string };
};

/**
 * Instantiates a {@link ViewMode} from its string identifier.
 */
export class ViewFactory {
  /**
   * Registered view modes, keyed by each class's static `name`.
   */
  static MODES: Record<string, ViewModeConstructor> = {
    [WeekView.name]: WeekView,
    [MonthView.name]: MonthView,
    [DayView.name]: DayView,
  };

  /**
   * Creates a view mode instance for the given identifier, falling back to
   * {@link WeekView} for unknown identifiers.
   */
  static fromString(str: string, options: ResourceCalendarOptions): ViewMode {
    const ViewClass = this.MODES[str] || WeekView;
    return new ViewClass(options);
  }
}
