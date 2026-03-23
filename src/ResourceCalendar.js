import "./style.css";
import { Temporal } from "temporal-polyfill";

import iconArrowRight from "./assets/chevron-right.svg?raw";
import iconArrowLeft from "./assets/chevron-left.svg?raw";

import { Utils } from "./utils";

import { ViewFactory } from "./ViewFactory";
import { Striping } from "./Striping";

import { Event } from "./Event";

export class ResourceCalendar {
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
      event.render();
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
      return {};
    },

    customButtons: {},

    // customOptions are options that are not used by the resource calendar and just are stored for calendar extensions
    customOptions: {},
  };

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

  /**
   * Creates an instance of ResourceCalendar
   * @param options This should be set when initializing a ResourceCalendar
   */
  constructor(options = {}) {
    this.options = { ...ResourceCalendar.DEFAULT_OPTIONS, ...options };

    this.container = document.getElementById(this.options.containerId);

    if (!this.container) {
      console.error(
        `ResourceCalendar Error: Container element with ID "${this.options.containerId}" not found.`,
      );
      return;
    }

    this.container.innerHTML = "";
    this.container._calendar = this;

    this.setViewMode(this.options.defaultViewMode, this.options.locale);
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

    this.updateCalendarData();

    // re-render calendar on window resize
    const calendar = this;
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (calendar.isRendered) {
          calendar.render();
        }
      }, 250);
    });

    this.rows = new Map();
  }

  rerender() {
    this.updateCalendarData();
    this.render();
  }

  updateCalendarData() {
    this.updateResources();
    this.updateDates();
  }

  updateResources() {
    this.resources = new Map(Object.entries(this.fetchResources()));
  }

  verifyResource(resourceId) {
    return resourceId && this.resources.has(resourceId);
  }

  setViewMode(viewmode) {
    this.viewmode = ViewFactory.fromString(viewmode, this.options);
  }

  selectDate(newDate) {
    this.selectedDate = newDate;
    this.updateDates();
    this.render();
  }

  /**
   * setDates according to viewmode, e.g. monday to sunday for weekview
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
   * Sends synchronous ajax request to initialize table; Synchronous because everything else relies on it, so it needs to be blocking
   * If passed, set gs variable to use search functionality/pass search parameters to server
   * @return {any}
   */
  fetchResources() {
    return this.fetchResourcesFunction(this);
  }

  fetchEventData() {
    return this.fetchEventDataFunction(this);
  }

  /**
   * update eventData variable before render()
   */
  updateEventData() {
    this.eventData = this.fetchEventData();
  }

  renderEvents() {
    const firstTd = this.container.querySelector("td");
    this.tdWidth = firstTd ? firstTd.offsetWidth : 0;

    // check if calendar is rendered
    if (!this.tdWidth) {
      return;
    }

    for (const i in this.eventData) {
      const event = Event.fromJSON(this, this.eventData[i]);

      if (event instanceof Event) {
        event.renderPartial();
      }
    }

    this.calendarEl.querySelectorAll("tr").forEach((tr) => {
      Event.updateRow(tr);
    });
  }

  /**
   * Clears the container and renders the resource calendar table based on the provided data
   */
  render() {
    if (!this.container) {
      console.error(
        "ResourceCalendar Error: Cannot render. Instance is not valid or container not found.",
      );
      return;
    }

    const calendar = this;

    this.calendarEl = document.createElement("div");

    const toolbar = this.createToolbar();
    this.calendarEl.append(toolbar);

    const table = this.createTable();
    this.calendarEl.append(table);

    this.container.innerHTML = "";
    this.container.append(this.calendarEl);

    this.dropzones = Array.from(this.container.querySelectorAll(".dropzone"));

    this.renderEvents();

    this.container.querySelectorAll("td").forEach((td) => {
      td.addEventListener("click", function (e) {
        const event = Event.fromClick(calendar, this, e);
        calendar.dateClick?.(event);
      });
    });

    this.dropzones.forEach((dz) => {
      dz.addEventListener("dragenter", function (e) {
        e.preventDefault();
        this.classList.add("drag-over");
      });

      dz.addEventListener("dragover", function (e) {
        e.preventDefault();
      });

      dz.addEventListener("dragleave", function () {
        this.classList.remove("drag-over");
      });

      dz.addEventListener("drop", function (e) {
        e.preventDefault();

        this.classList.remove("drag-over");

        const id = e.dataTransfer.getData("text/plain");
        const eventEl = document.getElementById(id);
        if (eventEl) {
          eventEl._dropTarget = e.target;
        }
      });
    });

    this.isRendered = true;
  }

  /**
   * Creates the table element
   * @returns {HTMLElement}
   */
  createTable() {
    const table = document.createElement("table");
    table.classList.add("table", "table-responsive", "table-hover");
    table.style.tableLayout = "fixed";
    table.append(this.createHeader());
    table.append(this.createBody());

    if (this.options.striping === Striping.ROWS) {
      table.classList.add("table-striped");
    }

    const tableContainer = document.createElement("div");
    tableContainer.classList.add("overflow-y-scroll", "overflow-x-hidden");
    tableContainer.style.height = "85vh";
    tableContainer.append(table);

    const col = document.createElement("div");
    col.classList.add("col");
    col.append(tableContainer);

    const row = document.createElement("div");
    row.classList.add("row");
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
    toolbarRow.classList.add("row", "mb-2");

    const toolbar = document.createElement("div");
    toolbar.classList.add(
      "rc-toolbar",
      "col",
      "d-flex",
      "justify-content-between",
    );

    toolbarRow.append(toolbar);

    const toolbarConfig = this.options.toolbar;

    for (const [key, value] of Object.entries(toolbarConfig)) {
      const toolbarPart = document.createElement("div");
      toolbarPart.classList.add("d-flex");

      let groups = value.split(" ");
      groups = groups.map((word) => word.split(","));

      for (const group of groups) {
        let groupEl;
        if (group.length > 1) {
          const buttonGroup = document.createElement("div");
          for (const button of group) {
            buttonGroup.append(this.createButton(this.buttons[button]));
          }
          groupEl = buttonGroup;
        } else if (group.length === 1) {
          groupEl = this.createButton(this.buttons[group[0]]);
        } else {
          continue;
        }
        toolbarPart.append(groupEl);
      }

      if (key === "start") {
        toolbarPart
          .querySelectorAll(":scope > *")
          .forEach((child) => child.classList.add("me-1"));
      } else if (key === "end") {
        toolbarPart
          .querySelectorAll(":scope > *")
          .forEach((child) => child.classList.add("ms-1"));
      }

      toolbar.append(toolbarPart);
    }

    return toolbarRow;
  }

  createViewModeButtons() {
    const viewmodeBtnDiv = document.createElement("div");
    const viewModes = ViewFactory.MODES;

    for (const viewmode in viewModes) {
      // todo: make this language independent, for now only on english
      const viewmodeTitle =
        String(viewmode).charAt(0).toUpperCase() + String(viewmode).slice(1);

      const iconHtml = viewModes[viewmode].buttonAttributes.iconHtml;

      const btn = document.createElement("button");
      btn.setAttribute("title", viewmodeTitle);
      btn.classList.add("btn", "btn-dark");
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

  createDateDisplay() {
    const headerText = this.viewmode.header(this.selectedDate);
    const span = document.createElement("span");
    span.classList.add("fw-bold", "fs-5");
    span.textContent = headerText;
    return span;
  }

  createButton(button) {
    if (typeof button.creationFunction === "function") {
      return button.creationFunction();
    }

    const btn = document.createElement("button");
    btn.classList.add("btn", "btn-dark");
    btn.addEventListener("click", (event) => button.onClick(event));

    if (button.iconHtml) {
      btn.innerHTML = button.iconHtml;
    } else if (button.iconClass) {
      if (button.text) {
        btn.setAttribute("title", button.text);
      }
      const icon = document.createElement("i");
      icon.className = button.icon;
      btn.append(icon);
    } else if (button.text) {
      btn.textContent = button.text;
    }

    return btn;
  }

  createDateSelect() {
    const input = document.createElement("input");
    input.classList.add("form-control", "me-1");
    input.type = "date";
    input.value = Utils.formatDateForInput(this.selectedDate);
    input.addEventListener("change", (event) => {
      const selectedDateString = event.target.value;
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
    thead.style.zIndex = 1000;

    const headerRow = document.createElement("tr");

    // First empty header cell (top-left corner)
    const cornerTh = document.createElement("th");
    cornerTh.setAttribute("scope", "col");
    cornerTh.setAttribute("colspan", this.subdivision);
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
      dateTh.setAttribute("colspan", this.subdivision);
      dateTh.style.position = "sticky";
      dateTh.style.top = "0px";
      dateTh.textContent = formattedDate;

      if (this.options.striping === Striping.COLUMNS && index % 2 === 0) {
        dateTh.style.boxShadow =
          "inset 0 0 0 9999px rgba(var(--bs-emphasis-color-rgb), 0.05)";
      }

      if (this.options.nowIndicator) {
        if (this.viewmode.equalsUnit(today, date)) {
          dateTh.classList.add("bg-warning");
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

    this.resources.forEach((resource, resourceId) => {
      const resourceRow = document.createElement("tr");

      const resourceTh = document.createElement("th");
      resourceTh.classList.add("p-1");
      resourceTh.setAttribute("scope", "row");
      resourceTh.setAttribute("colspan", this.subdivision);
      resourceTh.style.width = "15vw";
      resourceTh.innerHTML = `${resource} (${resourceId})`;
      resourceRow.append(resourceTh);

      for (let i = 0; i < this.dates.length; i++) {
        for (let j = 0; j < this.subdivision; j++) {
          const resourceTd = document.createElement("td");

          if (this.todayIndex && i === this.todayIndex) {
            resourceTd.classList.add("bg-warning-subtle");
          }

          if (this.options.striping === Striping.COLUMNS && i % 2 === 0) {
            resourceTd.style.boxShadow =
              "inset 0 0 0 9999px rgba(var(--bs-emphasis-color-rgb), 0.05)";
          }

          const borderStyle = j + 1 < this.subdivision ? "dashed" : "solid";
          resourceTd.style.borderRight = `1px rgba(0, 0, 0, 0.3) ${borderStyle}`;

          const dropzoneDiv = document.createElement("div");
          dropzoneDiv.classList.add("dropzone", "w-100", "h-100");
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

  getNext() {
    this.selectDate(this.viewmode.advanceBy(this.selectedDate, 1));
  }

  getPrev() {
    this.selectDate(this.viewmode.advanceBy(this.selectedDate, -1));
  }

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

  subdivisionsToTime(subdivisions) {
    return subdivisions * this.subdivisionInterval;
  }

  getNextDate(date) {
    return date
      .toZonedDateTime(Temporal.Now.timeZoneId())
      .add({ milliseconds: this.subdivisionInterval })
      .toPlainDateTime();
  }

  getDateFromDiffX(diffX) {
    const epochMs =
      this.startDate.toZonedDateTime(Temporal.Now.timeZoneId())
        .epochMilliseconds +
      (this.subdivisionInterval * diffX) / this.tdWidth;
    return Temporal.Instant.fromEpochMilliseconds(epochMs)
      .toZonedDateTimeISO(Temporal.Now.timeZoneId())
      .toPlainDateTime();
  }

  getDiffXFromDate(date) {
    const diffMs =
      date.toZonedDateTime(Temporal.Now.timeZoneId()).epochMilliseconds -
      this.startDate.toZonedDateTime(Temporal.Now.timeZoneId())
        .epochMilliseconds;
    return (diffMs / this.subdivisionInterval) * this.tdWidth;
  }

  getBoundedDiffXFromDate(date) {
    return Math.min(
      Math.max(this.getDiffXFromDate(date), 0),
      this.getDiffXFromDate(this.endDate),
    );
  }
}
