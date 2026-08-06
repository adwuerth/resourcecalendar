import "./style.css";
import { Temporal } from "temporal-polyfill";

import iconArrowRight from "./assets/chevron-right.svg?raw";
import iconArrowLeft from "./assets/chevron-left.svg?raw";

import { Utils } from "./utils";

import { ViewFactory } from "./ViewFactory";
import { Striping } from "./Striping";

import { Event } from "./Event";

/**
 * @typedef {import("./Striping").StripingMode} StripingMode
 * @typedef {import("./Event").EventJSON} EventJSON
 * @typedef {import("./ViewMode").ViewMode} ViewMode
 */

/**
 * A toolbar button definition. Either provides a `creationFunction` that
 * builds the whole element, or an `onClick` handler plus an icon/label.
 * @typedef {object} ButtonDefinition
 * @property {() => HTMLElement} [creationFunction]
 * @property {(event: MouseEvent) => void} [onClick]
 * @property {string} [iconHtml] - raw SVG/HTML string used as the button icon
 * @property {string} [iconClass] - CSS class set on an inner `<i>` element
 * @property {string} [text] - button label / tooltip text
 */

/**
 * Constructor options for {@link ResourceCalendar}. User-supplied options are
 * shallow-merged over {@link ResourceCalendar.DEFAULT_OPTIONS}.
 * @typedef {object} ResourceCalendarOptions
 * @property {string} containerId - id of the host element to render into
 * @property {string} defaultEventColor - CSS color for events without one
 * @property {Temporal.PlainDateTime|string} initialDate - date the calendar opens on
 * @property {boolean} nowIndicator - highlight the column for the current date/time
 * @property {boolean} selectable
 * @property {boolean} editable
 * @property {StripingMode} striping - row/column striping mode
 * @property {((event: Event) => void)|null} eventDrop
 * @property {((event: Event) => void)|null} eventClick - called when an event is clicked
 * @property {(event: Event|null) => void} dateClick - called when an empty cell is clicked
 * @property {((event: Event) => void)|null} saveEventFunction - persists a moved/resized event
 * @property {((event: Event) => void)|null} deleteEventFunction
 * @property {string} defaultViewMode - one of the registered ViewFactory modes
 * @property {string} locale - BCP-47 locale used for date formatting
 * @property {boolean} weekends - show Saturday/Sunday in week view
 * @property {string} minTime
 * @property {string} maxTime
 * @property {Record<string, number>} subdivision - columns per date, keyed by view mode name
 * @property {Record<string, string>} toolbar - toolbar layout DSL, keyed by region
 * @property {(calendar: ResourceCalendar) => Record<string, string>} fetchResourcesFunction
 * @property {(calendar: ResourceCalendar) => EventJSON[]} fetchEventDataFunction
 * @property {Record<string, ButtonDefinition>} customButtons
 * @property {Record<string, unknown>} customOptions - opaque store for calendar extensions
 * @property {string} [tabId]
 */

/**
 * The `<td>` a delegated DOM event happened in, or `null` when it happened
 * outside the grid (toolbar, header, table padding).
 * @param {globalThis.Event} e
 * @returns {HTMLTableCellElement|null}
 */
function tdOf(e) {
  return e.target instanceof Element ? e.target.closest("td") : null;
}

/**
 * The calendar orchestrator. Owns the lifecycle:
 * `updateCalendarData()` -> `render()` -> `renderEvents()`.
 */
export class ResourceCalendar {
  /** @type {ResourceCalendarOptions} */
  static DEFAULT_OPTIONS = {
    // calendar settings
    containerId: "container-resourcecalendar",
    defaultEventColor: "#5e5e5e",
    initialDate: Temporal.Now.plainDateTimeISO(),
    nowIndicator: true,
    selectable: true, // todo
    editable: true, // todo
    striping: Striping.DEFAULT,

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
    minTime: "00:00", // todo
    maxTime: "24:00", // todo
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

  /** @type {Record<string, ButtonDefinition>} */
  standardButtons = {
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

  /** @type {ResourceCalendarOptions} merged user + default options */
  options;
  /** @type {HTMLElement} the host element the calendar renders into */
  container;
  /** @type {ViewMode} the active view mode */
  viewmode;
  /** @type {Temporal.PlainDateTime} the currently selected date */
  selectedDate;
  /** @type {string|undefined} */
  tabId;
  /** @type {Map<string, string>} resource id -> label */
  resources;
  /** @type {Map<string, HTMLTableRowElement>} resource id -> table row */
  rows;
  /** @type {EventJSON[]} raw event data as last returned by the host */
  eventData;
  /**
   * @type {Set<Event>}
   */
  events = new Set();
  /** @type {Temporal.PlainDateTime[]} the visible column dates */
  dates;
  /** @type {Temporal.PlainDateTime} start of the visible range */
  startDate;
  /** @type {Temporal.PlainDateTime} end of the visible range */
  endDate;
  /** @type {number} columns per date */
  subdivision = 1;
  /** @type {number} milliseconds represented by one column */
  subdivisionInterval;
  /** @type {number} measured width of one table cell, in pixels */
  tdWidth = 0;
  /** @type {HTMLElement} the rendered calendar root element */
  calendarEl;
  /** @type {number|null} index of today's column, or null */
  todayIndex = null;
  /** @type {boolean} whether the calendar is currently rendered */
  isRendered = false;
  /** @type {Record<string, ButtonDefinition>} resolved toolbar buttons */
  buttons;
  /** @type {ResizeObserver|undefined} watches the container for width changes */
  _resizeObserver;
  /**
   * The event currently being dragged and the pointer x it was grabbed at.
   * Set on dragstart, cleared on dragend.
   * @type {{ event: Event, startX: number }|null}
   */
  _drag = null;
  /** @type {ResourceCalendarOptions["fetchResourcesFunction"]} */
  fetchResourcesFunction;
  /** @type {ResourceCalendarOptions["fetchEventDataFunction"]} */
  fetchEventDataFunction;
  /** @type {ResourceCalendarOptions["saveEventFunction"]} */
  saveEventFunction;
  /** @type {ResourceCalendarOptions["deleteEventFunction"]} */
  deleteEventFunction;
  /** @type {ResourceCalendarOptions["dateClick"]} */
  dateClick;
  /** @type {ResourceCalendarOptions["eventClick"]} */
  eventClick;

  /**
   * Creates an instance of ResourceCalendar.
   * @param {Partial<ResourceCalendarOptions>} [options] - overrides merged
   *   over {@link ResourceCalendar.DEFAULT_OPTIONS}
   */
  constructor(options = {}) {
    this.options = { ...ResourceCalendar.DEFAULT_OPTIONS, ...options };

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
   * @returns {void}
   */
  destroy() {
    this._resizeObserver?.disconnect();
    if (this.container) {
      this.container.innerHTML = "";
      delete this.container._calendar;
    }
    this.isRendered = false;
  }

  /**
   * Re-fetches data and re-renders the calendar.
   * @returns {void}
   */
  rerender() {
    this.updateCalendarData();
    this.render();
  }

  /**
   * Re-fetches resources and recomputes the visible date range.
   * @returns {void}
   */
  updateCalendarData() {
    this.updateResources();
    this.updateDates();
  }

  /**
   * Re-fetches the resource rows from the host.
   * @returns {void}
   */
  updateResources() {
    this.resources = new Map(Object.entries(this.fetchResources()));
  }

  /**
   * Whether the given resource id exists in the current resource set.
   * @param {string|null|undefined} resourceId
   * @returns {boolean}
   */
  verifyResource(resourceId) {
    return !!resourceId && this.resources.has(resourceId);
  }

  /**
   * Switches the active view mode (day/week/month).
   * @param {string} viewmode
   * @returns {void}
   */
  setViewMode(viewmode) {
    this.viewmode = ViewFactory.fromString(viewmode, this.options);
  }

  /**
   * Selects a new date, recomputes the range and re-renders.
   * @param {Temporal.PlainDateTime} newDate
   * @returns {void}
   */
  selectDate(newDate) {
    this.selectedDate = newDate;
    this.updateDates();
    this.render();
  }

  /**
   * Recomputes the visible date range, column dates and subdivision interval
   * for the current view mode, then refreshes event data.
   * @returns {void}
   */
  updateDates() {
    this.subdivision = this.viewmode.subdivision ?? 1;

    this.dates = this.viewmode.getDates(this.selectedDate);
    this.startDate = this.viewmode.getStartDate(this.selectedDate);
    this.endDate = this.viewmode.getEndDate(this.selectedDate);

    // todo maybe move this into viewmode
    // calculate the ms of one subdivided date (column)
    this.subdivisionInterval =
      Utils.calculateIntervalMilliseconds(this.dates[0], this.dates[1]) /
      this.subdivision;

    this.updateEventData();
  }

  /**
   * Fetches the resource rows via the host's `fetchResourcesFunction`.
   * @returns {Record<string, string>} resource id -> label
   */
  fetchResources() {
    return this.fetchResourcesFunction(this);
  }

  /**
   * Fetches event data via the host's `fetchEventDataFunction`.
   * @returns {EventJSON[]}
   */
  fetchEventData() {
    return this.fetchEventDataFunction(this);
  }

  /**
   * Re-fetches the event data from the host and rebuilds the event set from
   * it.
   * @returns {void}
   */
  updateEventData() {
    const data = this.fetchEventData();
    if (!Array.isArray(data)) {
      console.warn(
        "ResourceCalendar: fetchEventDataFunction should return an array of events.",
      );
    }
    /** @type {EventJSON[]} */
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
   * @returns {void}
   */
  renderEvents() {
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
   * @returns {void}
   */
  reflow() {
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
   * @param {HTMLTableRowElement|null} tr - the row under the cursor
   * @param {number} clientX
   * @returns {void}
   */
  highlightDropRange(tr, clientX) {
    this.clearDropHighlight();

    if (!tr || !this._drag || !this.tdWidth) {
      return;
    }

    const event = this._drag.event;
    const movedColumns = Math.round(
      (clientX - this._drag.startX) / this.tdWidth,
    );
    const startX = this.getBoundedDiffXFromDate(event.startDate);
    const endX = this.getBoundedDiffXFromDate(event.endDate);

    const first = Math.round(startX / this.tdWidth) + movedColumns;
    const span = Math.max(1, Math.round((endX - startX) / this.tdWidth));

    const cells = tr.querySelectorAll("td");
    for (let i = first; i < first + span; i++) {
      cells[i]?.classList.add("drag-over");
    }
  }

  /**
   * Removes the drop highlight from wherever it currently is.
   * @returns {void}
   */
  clearDropHighlight() {
    this.calendarEl
      ?.querySelectorAll(".drag-over")
      .forEach((cell) => cell.classList.remove("drag-over"));
  }

  /**
   * Clears the container and renders the toolbar + table, then places events
   * and wires up cell/dropzone interaction.
   * @returns {void}
   */
  render() {
    if (!this.container) {
      console.error(
        "ResourceCalendar Error: Cannot render. Instance is not valid or container not found.",
      );
      return;
    }

    this.calendarEl = document.createElement("div");

    const toolbar = this.createToolbar();
    this.calendarEl.append(toolbar);

    const table = this.createTable();
    this.calendarEl.append(table);

    this.container.innerHTML = "";
    this.container.append(this.calendarEl);

    this.renderEvents();

    this.calendarEl.addEventListener("click", (e) => {
      const td = tdOf(e);
      if (td) {
        this.dateClick?.(
          Event.fromClick(this, td, /** @type {MouseEvent} */ (e)),
        );
      }
    });

    this.calendarEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.highlightDropRange(
        tdOf(e)?.closest("tr") ?? null,
        /** @type {DragEvent} */ (e).clientX,
      );
    });

    this.calendarEl.addEventListener("dragleave", (e) => {
      const to = /** @type {DragEvent} */ (e).relatedTarget;
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

      const id = /** @type {DragEvent} */ (e).dataTransfer?.getData(
        "text/plain",
      );
      const eventEl = id ? document.getElementById(id) : null;
      if (eventEl) {
        eventEl._dropTarget = td;
      }
    });

    this.isRendered = true;
  }

  /**
   * Creates the table element
   * @returns {HTMLElement}
   */
  createTable() {
    const table = document.createElement("table");
    table.style.tableLayout = "fixed";
    table.append(this.createHeader());
    table.append(this.createBody());

    if (this.options.striping === Striping.ROWS) {
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
   * @returns {HTMLElement} The generated toolbar element.
   * @private
   */
  createToolbar() {
    const toolbarRow = document.createElement("div");
    toolbarRow.classList.add("rc-row");

    const toolbar = document.createElement("div");
    toolbar.classList.add("rc-toolbar", "rc-col");

    toolbarRow.append(toolbar);

    const toolbarConfig = this.options.toolbar;

    for (const [key, value] of Object.entries(toolbarConfig)) {
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
          .filter(Boolean);

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
   * @returns {HTMLElement}
   */
  createViewModeButtons() {
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
   * @returns {HTMLElement}
   */
  createDateDisplay() {
    const headerText = this.viewmode.header(this.selectedDate);
    const span = document.createElement("span");
    span.classList.add("rc-date-display");
    span.textContent = headerText;
    return span;
  }

  /**
   * Builds a single toolbar button element from its definition.
   * @param {ButtonDefinition} button
   * @returns {HTMLElement}
   */
  createButton(button) {
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
   * @returns {HTMLInputElement}
   */
  createDateSelect() {
    const input = document.createElement("input");
    input.classList.add("rc-date-input");
    input.type = "date";
    input.value = Utils.formatDateForInput(this.selectedDate);
    input.addEventListener("change", (event) => {
      const selectedDateString = /** @type {HTMLInputElement} */ (event.target)
        .value;
      const selectedDate = Temporal.PlainDate.from(
        selectedDateString,
      ).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
      this.selectDate(selectedDate);
    });
    return input;
  }

  /**
   * Creates the table header (<thead>) element
   * @returns {HTMLElement} The generated thead element.
   * @private
   */
  createHeader() {
    const thead = document.createElement("thead");
    thead.style.position = "sticky";
    thead.style.top = "0px";
    thead.style.zIndex = "1000";

    const headerRow = document.createElement("tr");

    // First empty header cell (top-left corner)
    const cornerTh = document.createElement("th");
    cornerTh.setAttribute("scope", "col");
    cornerTh.setAttribute("colspan", String(this.subdivision));
    cornerTh.style.width = "15vw";
    cornerTh.style.position = "sticky";
    cornerTh.style.top = "0px";
    headerRow.append(cornerTh);

    const today = Temporal.Now.plainDateTimeISO();
    this.todayIndex = null;

    // Date header cells
    this.dates.forEach((date, index) => {
      const formattedDate = this.viewmode.formatDate(date);

      const dateTh = document.createElement("th");
      dateTh.setAttribute("scope", "col");
      dateTh.setAttribute("colspan", String(this.subdivision));
      dateTh.style.position = "sticky";
      dateTh.style.top = "0px";
      dateTh.textContent = formattedDate;

      if (this.options.striping === Striping.COLUMNS && index % 2 === 0) {
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
   * @returns {HTMLElement} The generated tbody element.
   * @private
   */
  createBody() {
    const tbody = document.createElement("tbody");

    // drop rows from a previous render so removed resources do not linger
    this.rows.clear();

    this.resources.forEach((resource, resourceId) => {
      const resourceRow = document.createElement("tr");

      const resourceTh = document.createElement("th");
      resourceTh.classList.add("rc-resource-header");
      resourceTh.setAttribute("scope", "row");
      resourceTh.setAttribute("colspan", String(this.subdivision));
      resourceTh.style.width = "15vw";
      resourceTh.textContent = `${resource} (${resourceId})`;
      resourceRow.append(resourceTh);

      for (let i = 0; i < this.dates.length; i++) {
        for (let j = 0; j < this.subdivision; j++) {
          const resourceTd = document.createElement("td");

          if (this.todayIndex !== null && i === this.todayIndex) {
            resourceTd.classList.add("rc-today-subtle");
          }

          if (this.options.striping === Striping.COLUMNS && i % 2 === 0) {
            resourceTd.classList.add("rc-col-stripe");
          }

          const borderStyle = j + 1 < this.subdivision ? "dashed" : "solid";
          resourceTd.style.borderRight = `1px rgba(0, 0, 0, 0.3) ${borderStyle}`;

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
   * @returns {void}
   */
  getNext() {
    this.selectDate(this.viewmode.advanceBy(this.selectedDate, 1));
  }

  /**
   * Moves the calendar to the previous view (previous day/week/month).
   * @returns {void}
   */
  getPrev() {
    this.selectDate(this.viewmode.advanceBy(this.selectedDate, -1));
  }

  /**
   * Whether the date range `[startDate, endDate]` overlaps the calendar's
   * currently visible range.
   * @param {Temporal.PlainDateTime} startDate
   * @param {Temporal.PlainDateTime} endDate
   * @returns {boolean}
   */
  verifyDateValidity(startDate, endDate) {
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
   * @param {number} subdivisions
   * @returns {number}
   */
  subdivisionsToTime(subdivisions) {
    return subdivisions * this.subdivisionInterval;
  }

  /**
   * The date one subdivision column after `date`.
   * @param {Temporal.PlainDateTime} date
   * @returns {Temporal.PlainDateTime}
   */
  getNextDate(date) {
    return date.add({ milliseconds: this.subdivisionInterval });
  }

  /**
   * Pixel x-offset (measured from the calendar start) -> date.
   * Uses wall-clock (PlainDateTime) math so it is unaffected by DST shifts.
   * @param {number} diffX
   * @returns {Temporal.PlainDateTime}
   */
  getDateFromDiffX(diffX) {
    const offsetMs = (this.subdivisionInterval * diffX) / this.tdWidth;
    return this.startDate.add({ milliseconds: Math.round(offsetMs) });
  }

  /**
   * Date -> pixel x-offset (measured from the calendar start).
   * Uses wall-clock (PlainDateTime) math so it is unaffected by DST shifts.
   * @param {Temporal.PlainDateTime} date
   * @returns {number}
   */
  getDiffXFromDate(date) {
    const diffMs = date
      .since(this.startDate, { largestUnit: "hour" })
      .total({ unit: "milliseconds" });
    return (diffMs / this.subdivisionInterval) * this.tdWidth;
  }

  /**
   * Snaps a date to the subdivision grid. Grid lines sit at
   * startDate + k * subdivisionInterval; mode is "floor", "ceil" or "round".
   * @param {Temporal.PlainDateTime} date
   * @param {"floor"|"ceil"|"round"} mode
   * @returns {Temporal.PlainDateTime}
   */
  snapToGrid(date, mode = "round") {
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
   * @param {Temporal.PlainDateTime} date
   * @returns {number}
   */
  getBoundedDiffXFromDate(date) {
    return Math.min(
      Math.max(this.getDiffXFromDate(date), 0),
      this.getDiffXFromDate(this.endDate),
    );
  }
}
