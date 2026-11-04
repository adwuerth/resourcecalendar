// The only CSS import in the library; it is what makes Vite emit
// dist/resourcecalendar.css. It survives into ResourceCalendar.d.ts, which the
// build resolves with an empty dist/style.css.d.ts shim.
import "./style.css";
import { Temporal } from "temporal-polyfill";

import iconArrowRight from "./assets/chevron-right.svg?raw";
import iconArrowLeft from "./assets/chevron-left.svg?raw";

import { Utils } from "./utils";

import { ViewFactory } from "./ViewFactory";

import { Event } from "./Event";
import type { EventJSON } from "./Event";
import type { ViewMode } from "./ViewMode";

/**
 * Row/column striping of the calendar grid.
 */
export type StripingMode = "none" | "columns" | "rows";

/**
 * CSS framework whose theme variables the calendar maps onto.
 */
export type ThemeMode = "none" | "bootstrap5" | "tailwind4";

/**
 * A toolbar button definition. Either provides a `creationFunction` that
 * builds the whole element, or an `onClick` handler plus an icon/label.
 */
export interface ButtonDefinition {
  creationFunction?: () => HTMLElement;
  onClick?: (event: MouseEvent) => void;
  /** raw SVG/HTML string used as the button icon */
  iconHtml?: string;
  /** CSS class set on an inner `<i>` element */
  iconClass?: string;
  /** button label / tooltip text */
  text?: string;
}

/**
 * Constructor options for {@link ResourceCalendar}. User-supplied options are
 * shallow-merged over {@link ResourceCalendar.DEFAULT_OPTIONS}.
 */
export interface ResourceCalendarOptions {
  /** id of the host element to render into */
  containerId: string;
  /** CSS color for events without one */
  defaultEventColor: string;
  /** date the calendar opens on */
  initialDate: Temporal.PlainDateTime | string;
  /** highlight the column for the current date/time */
  nowIndicator: boolean;
  /** whether clicking an empty cell calls `dateClick` (by default creating an event) */
  selectable: boolean;
  /** whether events can be created, dragged and resized */
  editable: boolean;
  /** row/column striping mode */
  striping: StripingMode;
  /** CSS framework whose palette the calendar should adopt */
  theming: ThemeMode;
  /** called after an event was dragged to a new time or resource, and saved */
  eventDrop: ((event: Event) => void) | null;
  /** called when an event is clicked */
  eventClick: ((event: Event) => void) | null;
  /** called when an empty cell is clicked */
  dateClick: (event: Event | null) => void;
  /** persists a moved/resized event */
  saveEventFunction: ((event: Event) => void) | null;
  deleteEventFunction: ((event: Event) => void) | null;
  /** one of the registered ViewFactory modes */
  defaultViewMode: string;
  /** BCP-47 locale used for date formatting */
  locale: string;
  /** show Saturday/Sunday in week view */
  weekends: boolean;
  /** first visible time of day in day view, `"HH:MM"` */
  minTime: string;
  /** end of the visible day in day view, `"HH:MM"` (up to `"24:00"`) */
  maxTime: string;
  /** columns per date, keyed by view mode name */
  subdivision: Record<string, number>;
  /** toolbar layout DSL, keyed by region */
  toolbar: Record<string, string>;
  fetchResourcesFunction: (
    calendar: ResourceCalendar,
  ) => Record<string, string>;
  fetchEventDataFunction: (calendar: ResourceCalendar) => EventJSON[];
  customButtons: Record<string, ButtonDefinition>;
  /** opaque store for calendar extensions */
  customOptions: Record<string, unknown>;
  tabId?: string;
}

/**
 * The `<td>` a delegated DOM event happened in, or `null` when it happened
 * outside the grid (toolbar, header, table padding).
 */
function tdOf(e: globalThis.Event): HTMLTableCellElement | null {
  return e.target instanceof Element ? e.target.closest("td") : null;
}

/**
 * The calendar orchestrator. Owns the lifecycle:
 * `updateCalendarData()` -> `render()` -> `renderEvents()`.
 */
export class ResourceCalendar {
  static DEFAULT_OPTIONS: ResourceCalendarOptions = {
    // calendar settings
    containerId: "container-resourcecalendar",
    defaultEventColor: "#5e5e5e",
    initialDate: Temporal.Now.plainDateTimeISO(),
    nowIndicator: true,
    selectable: true,
    editable: true,
    striping: "none",
    theming: "none",

    eventDrop: null,
    eventClick: null,
    dateClick: (event) => {
      event?.render();
    },

    saveEventFunction: null,
    deleteEventFunction: null,

    // viewmode settings
    defaultViewMode: "week",
    locale: navigator.language,
    weekends: true,
    minTime: "00:00",
    maxTime: "24:00",
    subdivision: {
      week: 1,
      month: 1,
      day: 1,
    },

    toolbar: {
      start: "viewMode",
      center: "dateDisplay",
      end: "dateSelect prev next",
    },

    fetchResourcesFunction: () => {
      return {};
    },
    fetchEventDataFunction: () => {
      return [];
    },

    customButtons: {},

    // customOptions are options that are not used by the resource calendar and just are stored for calendar extensions
    customOptions: {},
  };

  standardButtons: Record<string, ButtonDefinition> = {
    viewMode: {
      creationFunction: this.createViewModeButtons.bind(this),
    },
    dateDisplay: {
      creationFunction: this.createDateDisplay.bind(this),
    },
    dateSelect: {
      creationFunction: this.createDateSelect.bind(this),
    },
    prev: {
      iconHtml: iconArrowLeft,
      onClick: this.getPrev.bind(this),
    },
    next: {
      iconHtml: iconArrowRight,
      onClick: this.getNext.bind(this),
    },
  };

  /** merged user + default options */
  options: ResourceCalendarOptions;
  /** the host element the calendar renders into */
  container: HTMLElement;
  /** the active view mode */
  viewmode: ViewMode;
  /** the currently selected date */
  selectedDate: Temporal.PlainDateTime;
  tabId: string | undefined;
  /** resource id -> label */
  resources: Map<string, string>;
  /** resource id -> table row */
  rows: Map<string, HTMLTableRowElement>;
  /** raw event data as last returned by the host */
  eventData: EventJSON[];
  /** the live events, the source of truth while the calendar runs */
  events = new Set<Event>();
  /** the visible column dates */
  dates: Temporal.PlainDateTime[];
  /** start of the visible range */
  startDate: Temporal.PlainDateTime;
  /** end of the visible range */
  endDate: Temporal.PlainDateTime;
  /** columns per date */
  subdivision = 1;
  /** milliseconds represented by one column */
  subdivisionInterval: number;
  /** measured width of one table cell, in pixels */
  tdWidth = 0;
  /** the rendered calendar root element */
  calendarEl: HTMLElement;
  /** index of today's column, or null */
  todayIndex: number | null = null;
  /** whether the calendar is currently rendered */
  isRendered = false;
  /** resolved toolbar buttons */
  buttons: Record<string, ButtonDefinition>;
  /** watches the container for width changes */
  _resizeObserver: ResizeObserver | undefined;
  /**
   * The event currently being dragged and the pointer x it was grabbed at.
   * Set on dragstart, cleared on dragend.
   */
  _drag: { event: Event; startX: number } | null = null;
  /** cells currently carrying the drop highlight */
  _highlighted: HTMLTableCellElement[] = [];
  fetchResourcesFunction: ResourceCalendarOptions["fetchResourcesFunction"];
  fetchEventDataFunction: ResourceCalendarOptions["fetchEventDataFunction"];
  saveEventFunction: ResourceCalendarOptions["saveEventFunction"];
  deleteEventFunction: ResourceCalendarOptions["deleteEventFunction"];
  dateClick: ResourceCalendarOptions["dateClick"];
  eventClick: ResourceCalendarOptions["eventClick"];
  eventDrop: ResourceCalendarOptions["eventDrop"];

  /**
   * Creates an instance of ResourceCalendar.
   * @param options - overrides merged over
   *   {@link ResourceCalendar.DEFAULT_OPTIONS}
   */
  constructor(options: Partial<ResourceCalendarOptions> = {}) {
    this.options = { ...ResourceCalendar.DEFAULT_OPTIONS, ...options };

    if (
      this.options.theming !== "none" &&
      options.defaultEventColor === undefined
    ) {
      this.options.defaultEventColor = "";
    }

    const container = document.getElementById(this.options.containerId);

    if (!container) {
      console.error(
        `ResourceCalendar Error: Container element with ID "${this.options.containerId}" not found.`,
      );
      return;
    }

    this.container = container;

    this.container.innerHTML = "";
    this.container._calendar = this;

    this.setViewMode(this.options.defaultViewMode);
    this.selectedDate =
      this.options.initialDate instanceof Temporal.PlainDateTime
        ? this.options.initialDate
        : Temporal.PlainDateTime.from(this.options.initialDate);
    this.tabId = this.options.tabId;

    this.fetchResourcesFunction = this.options.fetchResourcesFunction;
    this.fetchEventDataFunction = this.options.fetchEventDataFunction;
    this.saveEventFunction = this.options.saveEventFunction;
    this.deleteEventFunction = this.options.deleteEventFunction;
    this.dateClick = this.options.dateClick;
    this.eventClick = this.options.eventClick;
    this.eventDrop = this.options.eventDrop;
    this.buttons = { ...this.standardButtons, ...this.options.customButtons };

    this.rows = new Map();

    this.updateCalendarData();

    this._resizeObserver = new ResizeObserver(() => this.reflow());
    this._resizeObserver.observe(this.container);
  }

  /**
   * Detaches the calendar: removes it from the DOM and unregisters the
   * global resize listener. Call this before discarding an instance so
   * repeated creation does not leak listeners.
   */
  destroy(): void {
    this._resizeObserver?.disconnect();
    if (this.container) {
      this.container.innerHTML = "";
      delete this.container._calendar;
    }
    this.isRendered = false;
  }

  /**
   * Re-fetches data and re-renders the calendar.
   */
  rerender(): void {
    this.updateCalendarData();
    this.render();
  }

  /**
   * Re-fetches resources and recomputes the visible date range.
   */
  updateCalendarData(): void {
    this.updateResources();
    this.updateDates();
  }

  /**
   * Re-fetches the resource rows from the host.
   */
  updateResources(): void {
    this.resources = new Map(Object.entries(this.fetchResources()));
  }

  /**
   * Whether the given resource id exists in the current resource set.
   */
  verifyResource(resourceId: string | null | undefined): boolean {
    return !!resourceId && this.resources.has(resourceId);
  }

  /**
   * Switches the active view mode (day/week/month).
   */
  setViewMode(viewmode: string): void {
    this.viewmode = ViewFactory.fromString(viewmode, this.options);
  }

  /**
   * Selects a new date, recomputes the range and re-renders.
   */
  selectDate(newDate: Temporal.PlainDateTime): void {
    this.selectedDate = newDate;
    this.updateDates();
    this.render();
  }

  /**
   * Recomputes the visible date range, column dates and subdivision interval
   * for the current view mode, then refreshes event data.
   */
  updateDates(): void {
    this.subdivision = this.viewmode.subdivision ?? 1;

    this.dates = this.viewmode.getDates(this.selectedDate);
    this.startDate = this.viewmode.getStartDate(this.selectedDate);
    this.endDate = this.viewmode.getEndDate(this.selectedDate);

    // todo maybe move this into viewmode
    // calculate the ms of one subdivided date (column)
    this.subdivisionInterval =
      Utils.calculateIntervalMilliseconds(
        this.dates[0],
        this.dates[1] ?? this.endDate,
      ) /
      this.subdivision;

    this.updateEventData();
  }

  /**
   * Fetches the resource rows via the host's `fetchResourcesFunction`.
   * @returns resource id -> label
   */
  fetchResources(): Record<string, string> {
    return this.fetchResourcesFunction(this);
  }

  /**
   * Fetches event data via the host's `fetchEventDataFunction`.
   */
  fetchEventData(): EventJSON[] {
    return this.fetchEventDataFunction(this);
  }

  /**
   * Re-fetches the event data from the host and rebuilds the event set from
   * it.
   */
  updateEventData(): void {
    const data = this.fetchEventData();
    if (!Array.isArray(data)) {
      console.warn(
        "ResourceCalendar: fetchEventDataFunction should return an array of events.",
      );
    }
    this.eventData = Array.isArray(data) ? data : [];

    this.events.forEach((event) => event.detach());
    this.events = new Set(
      this.eventData
        .map((data) => Event.fromJSON(this, data))
        .filter((event) => event instanceof Event),
    );
  }

  /**
   * Places every live event and restacks all rows. Reuses the existing
   * {@link Event} instances (and their elements) rather than rebuilding them
   * from the raw data, so a re-render keeps whatever the user changed.
   */
  renderEvents(): void {
    const firstTd = this.container.querySelector("td");
    this.tdWidth = firstTd ? firstTd.offsetWidth : 0;

    // check if calendar is rendered
    if (!this.tdWidth) {
      return;
    }

    this.events.forEach((event) => event.renderPartial());

    this.calendarEl.querySelectorAll("tr").forEach((tr) => {
      Event.updateRow(tr);
    });
  }

  /**
   * Re-measures the column width and repositions the events that are already
   * in the DOM. Unlike {@link ResourceCalendar#render} this rebuilds nothing
   * and reads no event data, so events created or moved since the last fetch
   * survive a resize.
   */
  reflow(): void {
    if (!this.isRendered) {
      return;
    }

    const firstTd = this.container.querySelector("td");
    const tdWidth = firstTd ? firstTd.offsetWidth : 0;

    if (!tdWidth || tdWidth === this.tdWidth) {
      return;
    }
    this.tdWidth = tdWidth;

    this.events.forEach((event) => event.renderUpdate());
  }

  /**
   * Highlights the cells the dragged event would occupy if it were dropped at
   * the cursor's current position
   * @param tr - the row under the cursor
   */
  highlightDropRange(tr: HTMLTableRowElement | null, clientX: number): void {
    this.clearDropHighlight();

    if (!tr || !this._drag || !this.tdWidth) {
      return;
    }

    const movedColumns = Math.round(
      (clientX - this._drag.startX) / this.tdWidth,
    );
    const { start, end } = this._drag.event.displayRange();
    const startX = this.getBoundedDiffXFromDate(start);
    const endX = this.getBoundedDiffXFromDate(end);

    const first = Math.round(startX / this.tdWidth) + movedColumns;
    const span = Math.max(1, Math.round((endX - startX) / this.tdWidth));

    const cells = tr.querySelectorAll("td");
    for (let i = first; i < first + span; i++) {
      const cell = cells[i];
      if (cell) {
        cell.classList.add("drag-over");
        this._highlighted.push(cell);
      }
    }
  }

  /**
   * Removes the drop highlight from wherever it currently is.
   */
  clearDropHighlight(): void {
    this._highlighted.forEach((cell) => cell.classList.remove("drag-over"));
    this._highlighted = [];
  }

  /**
   * Clears the container and renders the toolbar + table, then places events
   * and wires up cell/dropzone interaction.
   */
  render(): void {
    if (!this.container) {
      console.error(
        "ResourceCalendar Error: Cannot render. Instance is not valid or container not found.",
      );
      return;
    }

    this.calendarEl = document.createElement("div");
    this.calendarEl.classList.add("rc-calendar");
    if (this.options.theming !== "none") {
      this.calendarEl.classList.add(`rc-theme-${this.options.theming}`);
    }
    if (!this.options.editable) {
      this.calendarEl.classList.add("rc-readonly");
    }

    const toolbar = this.createToolbar();
    this.calendarEl.append(toolbar);

    const table = this.createTable();
    this.calendarEl.append(table);

    this.container.innerHTML = "";
    this.container.append(this.calendarEl);

    this.renderEvents();

    this.calendarEl.addEventListener("click", (e) => {
      const td = tdOf(e);
      if (td && this.options.selectable && this.options.editable) {
        this.dateClick?.(Event.fromClick(this, td, e));
      }
    });

    this.calendarEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.highlightDropRange(tdOf(e)?.closest("tr") ?? null, e.clientX);
    });

    this.calendarEl.addEventListener("dragleave", (e) => {
      const to = e.relatedTarget;
      if (!(to instanceof Node) || !this.calendarEl.contains(to)) {
        this.clearDropHighlight();
      }
    });

    this.calendarEl.addEventListener("drop", (e) => {
      e.preventDefault();
      this.clearDropHighlight();

      const td = tdOf(e);
      if (!td) {
        return;
      }

      const id = e.dataTransfer?.getData("text/plain");
      const eventEl = id ? document.getElementById(id) : null;
      if (eventEl) {
        eventEl._dropTarget = td;
      }
    });

    this.isRendered = true;
  }

  /**
   * Creates the table element
   */
  createTable(): HTMLElement {
    const table = document.createElement("table");
    table.append(this.createHeader());
    table.append(this.createBody());

    if (this.options.striping === "rows") {
      table.classList.add("rc-table-striped");
    }

    const tableContainer = document.createElement("div");
    tableContainer.classList.add("rc-table-container");
    tableContainer.append(table);

    const col = document.createElement("div");
    col.classList.add("rc-col");
    col.append(tableContainer);

    const row = document.createElement("div");
    row.classList.add("rc-row");
    row.append(col);

    return row;
  }

  /**
   * Creates the toolbar element
   * @returns The generated toolbar element.
   */
  private createToolbar(): HTMLElement {
    const toolbarRow = document.createElement("div");
    toolbarRow.classList.add("rc-row");

    const toolbar = document.createElement("div");
    toolbar.classList.add("rc-toolbar", "rc-col");

    toolbarRow.append(toolbar);

    const toolbarConfig = this.options.toolbar;

    for (const [, value] of Object.entries(toolbarConfig)) {
      const toolbarPart = document.createElement("div");
      toolbarPart.classList.add("rc-toolbar-part");

      const groups = value
        .split(" ")
        .filter((token) => token.length > 0)
        .map((token) => token.split(",").filter((name) => name.length > 0));

      for (const group of groups) {
        const buttons = group
          .map((name) => {
            const button = this.buttons[name];
            if (!button) {
              console.warn(
                `ResourceCalendar: unknown toolbar button "${name}".`,
              );
            }
            return button;
          })
          .filter((button): button is ButtonDefinition => !!button);

        if (buttons.length === 0) {
          continue;
        }

        if (buttons.length > 1) {
          const buttonGroup = document.createElement("div");
          buttonGroup.classList.add("rc-toolbar-part");
          for (const button of buttons) {
            buttonGroup.append(this.createButton(button));
          }
          toolbarPart.append(buttonGroup);
        } else {
          toolbarPart.append(this.createButton(buttons[0]));
        }
      }

      toolbar.append(toolbarPart);
    }

    return toolbarRow;
  }

  /**
   * Builds the view-mode switch button group.
   */
  createViewModeButtons(): HTMLElement {
    const viewmodeBtnDiv = document.createElement("div");
    viewmodeBtnDiv.classList.add("rc-toolbar-part");
    const viewModes = ViewFactory.MODES;

    for (const viewmode in viewModes) {
      // todo: make this language independent, for now only on english
      const viewmodeTitle =
        String(viewmode).charAt(0).toUpperCase() + String(viewmode).slice(1);

      const iconHtml = viewModes[viewmode].buttonAttributes.iconHtml;

      const btn = document.createElement("button");
      btn.setAttribute("title", viewmodeTitle);
      btn.classList.add("rc-btn");
      btn.innerHTML = iconHtml;
      btn.addEventListener("click", () => {
        this.setViewMode(viewmode);
        this.updateDates();
        this.render();
      });

      if (viewModes[viewmode].name === this.viewmode.name) {
        btn.classList.add("active");
      }

      viewmodeBtnDiv.append(btn);
    }

    return viewmodeBtnDiv;
  }

  /**
   * Builds the toolbar element showing the current view's header text.
   */
  createDateDisplay(): HTMLElement {
    const headerText = this.viewmode.header(this.selectedDate);
    const span = document.createElement("span");
    span.classList.add("rc-date-display");
    span.textContent = headerText;
    return span;
  }

  /**
   * Builds a single toolbar button element from its definition.
   */
  createButton(button: ButtonDefinition): HTMLElement {
    if (typeof button.creationFunction === "function") {
      return button.creationFunction();
    }

    const btn = document.createElement("button");
    btn.classList.add("rc-btn");
    btn.addEventListener("click", (event) => button.onClick?.(event));

    if (button.iconHtml) {
      btn.innerHTML = button.iconHtml;
    } else if (button.iconClass) {
      if (button.text) {
        btn.setAttribute("title", button.text);
      }
      const icon = document.createElement("i");
      icon.className = button.iconClass;
      btn.append(icon);
    } else if (button.text) {
      btn.textContent = button.text;
    }

    return btn;
  }

  /**
   * Builds the `<input type="date">` date picker for the toolbar.
   */
  createDateSelect(): HTMLInputElement {
    const input = document.createElement("input");
    input.classList.add("rc-date-input");
    input.type = "date";
    input.value = Utils.formatDateForInput(this.selectedDate);
    input.addEventListener("change", (event) => {
      const selectedDateString = (event.target as HTMLInputElement).value;
      const selectedDate = Temporal.PlainDate.from(
        selectedDateString,
      ).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
      this.selectDate(selectedDate);
    });
    return input;
  }

  /**
   * Creates the table header (<thead>) element
   * @returns The generated thead element.
   */
  private createHeader(): HTMLElement {
    const thead = document.createElement("thead");

    const headerRow = document.createElement("tr");

    // First empty header cell (top-left corner)
    const cornerTh = document.createElement("th");
    cornerTh.setAttribute("scope", "col");
    cornerTh.setAttribute("colspan", String(this.subdivision));
    cornerTh.classList.add("rc-corner");
    headerRow.append(cornerTh);

    const today = Temporal.Now.plainDateTimeISO();
    this.todayIndex = null;

    // Date header cells
    this.dates.forEach((date, index) => {
      const formattedDate = this.viewmode.formatDate(date);

      const dateTh = document.createElement("th");
      dateTh.setAttribute("scope", "col");
      dateTh.setAttribute("colspan", String(this.subdivision));
      dateTh.textContent = formattedDate;

      if (this.options.striping === "columns" && index % 2 === 0) {
        dateTh.classList.add("rc-col-stripe");
      }

      if (this.options.nowIndicator) {
        if (this.viewmode.equalsUnit(today, date)) {
          dateTh.classList.add("rc-today");
          this.todayIndex = index;
        }
      }

      headerRow.append(dateTh);
    });

    thead.append(headerRow);
    return thead;
  }

  /**
   * Creates the table body (<tbody>) element
   * @returns The generated tbody element.
   */
  private createBody(): HTMLElement {
    const tbody = document.createElement("tbody");

    // drop rows from a previous render so removed resources do not linger
    this.rows.clear();

    this.resources.forEach((resource, resourceId) => {
      const resourceRow = document.createElement("tr");

      const resourceTh = document.createElement("th");
      resourceTh.classList.add("rc-resource-header");
      resourceTh.setAttribute("scope", "row");
      resourceTh.setAttribute("colspan", String(this.subdivision));
      resourceTh.textContent = `${resource} (${resourceId})`;
      resourceRow.append(resourceTh);

      for (let i = 0; i < this.dates.length; i++) {
        for (let j = 0; j < this.subdivision; j++) {
          const resourceTd = document.createElement("td");

          if (this.todayIndex !== null && i === this.todayIndex) {
            resourceTd.classList.add("rc-today-subtle");
          }

          if (this.options.striping === "columns" && i % 2 === 0) {
            resourceTd.classList.add("rc-col-stripe");
          }

          if (j + 1 < this.subdivision) {
            resourceTd.classList.add("rc-subdivision");
          }

          const dropzoneDiv = document.createElement("div");
          dropzoneDiv.classList.add("dropzone");
          resourceTd.append(dropzoneDiv);

          resourceRow.append(resourceTd);
        }
      }

      resourceRow.dataset.resource_id = resourceId;
      resourceRow._heightIndex = 0;

      tbody.append(resourceRow);
      this.rows.set(resourceId, resourceRow);
    });

    return tbody;
  }

  /**
   * Advances the calendar to the next view (next day/week/month).
   */
  getNext(): void {
    this.selectDate(this.viewmode.advanceBy(this.selectedDate, 1));
  }

  /**
   * Moves the calendar to the previous view (previous day/week/month).
   */
  getPrev(): void {
    this.selectDate(this.viewmode.advanceBy(this.selectedDate, -1));
  }

  /**
   * Whether the date range `[startDate, endDate]` overlaps the calendar's
   * currently visible range.
   */
  verifyDateValidity(
    startDate: Temporal.PlainDateTime,
    endDate: Temporal.PlainDateTime,
  ): boolean {
    if (
      !startDate ||
      !endDate ||
      !this.startDate ||
      !this.endDate ||
      Temporal.PlainDateTime.compare(startDate, endDate) > 0 ||
      Temporal.PlainDateTime.compare(this.startDate, this.endDate) > 0
    ) {
      return false;
    }
    const cmp = Temporal.PlainDateTime.compare;
    const startDateBetweenBounds =
      cmp(startDate, this.endDate) < 0 && cmp(startDate, this.startDate) >= 0;
    const endDateBetweenBounds =
      cmp(endDate, this.startDate) > 0 && cmp(endDate, this.endDate) < 0;
    const bothOverbounds =
      cmp(this.startDate, startDate) >= 0 && cmp(this.endDate, endDate) <= 0;
    return startDateBetweenBounds || endDateBetweenBounds || bothOverbounds;
  }

  /**
   * Converts a column count to a duration in milliseconds.
   */
  subdivisionsToTime(subdivisions: number): number {
    return subdivisions * this.subdivisionInterval;
  }

  /**
   * The date one subdivision column after `date`.
   */
  getNextDate(date: Temporal.PlainDateTime): Temporal.PlainDateTime {
    return date.add({ milliseconds: this.subdivisionInterval });
  }

  /**
   * Pixel x-offset (measured from the calendar start) -> date.
   * Uses wall-clock (PlainDateTime) math so it is unaffected by DST shifts.
   */
  getDateFromDiffX(diffX: number): Temporal.PlainDateTime {
    const offsetMs = (this.subdivisionInterval * diffX) / this.tdWidth;
    return this.startDate.add({ milliseconds: Math.round(offsetMs) });
  }

  /**
   * Date -> pixel x-offset (measured from the calendar start).
   * Uses wall-clock (PlainDateTime) math so it is unaffected by DST shifts.
   */
  getDiffXFromDate(date: Temporal.PlainDateTime): number {
    const diffMs = date
      .since(this.startDate, { largestUnit: "hour" })
      .total({ unit: "milliseconds" });
    return (diffMs / this.subdivisionInterval) * this.tdWidth;
  }

  /**
   * Snaps a date to the subdivision grid. Grid lines sit at
   * startDate + k * subdivisionInterval; mode is "floor", "ceil" or "round".
   */
  snapToGrid(
    date: Temporal.PlainDateTime,
    mode: "floor" | "ceil" | "round" = "round",
  ): Temporal.PlainDateTime {
    const offsetMs = date
      .since(this.startDate, { largestUnit: "hour" })
      .total({ unit: "milliseconds" });
    const round =
      mode === "ceil" ? Math.ceil : mode === "floor" ? Math.floor : Math.round;
    const snappedMs =
      round(offsetMs / this.subdivisionInterval) * this.subdivisionInterval;
    return this.startDate.add({ milliseconds: snappedMs });
  }

  /**
   * Like {@link ResourceCalendar#getDiffXFromDate} but clamped to the
   * visible `[0, end]` pixel range.
   */
  getBoundedDiffXFromDate(date: Temporal.PlainDateTime): number {
    return Math.min(
      Math.max(this.getDiffXFromDate(date), 0),
      this.getDiffXFromDate(this.endDate),
    );
  }
}
