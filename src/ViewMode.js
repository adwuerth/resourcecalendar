/**
 * ViewMode determines table date layout, formatting etc.
 */
export class ViewMode {
  static DEFAULT_LOCALE = "en-US";

  constructor(name, options) {
    if (this.constructor === ViewMode) {
      throw new Error("Abstract class ViewMode cannot be instantiated.");
    }
    this.name = name;
    this.subdivision = options.subdivision[name] ?? 1;
    this.locale = options.locale ?? ViewMode.DEFAULT_LOCALE;
    this.weekends = options.weekends ?? true;
  }

  formatDate(date) {}

  advanceBy(date, by) {}

  getDates(date = Temporal.Now.plainDateISO()) {}

  getStartDate(date) {}

  getEndDate(date) {
    return this.advanceBy(this.getStartDate(date), 1);
  }

  equalsUnit(date1, date2) {}

  header(date) {}
}
