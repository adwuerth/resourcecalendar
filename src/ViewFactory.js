import { WeekView } from "./WeekView.js";
import { DayView } from "./DayView.js";
import { MonthView } from "./MonthView.js";

export class ViewFactory {
  static MODES = {
    [WeekView.name]: WeekView,
    [MonthView.name]: MonthView,
    [DayView.name]: DayView,
  };

  static fromString(str, options = {}) {
    const ViewClass = this.MODES[str] || WeekView;
    return new ViewClass(options);
  }
}
