import $ from "jquery";
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

    this.container = $("#" + this.options.containerId);
    this.container.empty();

    if (this.container.length === 0) {
      console.error(
        `ResourceCalendar Error: Container element with ID "${this.options.containerId}" not found.`,
      );
      return;
    }

    this.container.data("calendar", this);

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
    this.tdWidth = this.container.find("td").outerWidth();

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

    this.$calendar.find("tr").each((index, tr) => {
      Event.updateRow($(tr));
    });
  }

  /**
   * Clears the container and renders the resource calendar table based on the provided data
   */
  render() {
    if (!this.container || this.container.length === 0) {
      console.error(
        "ResourceCalendar Error: Cannot render. Instance is not valid or container not found.",
      );
      return;
    }

    const calendar = this;

    this.$calendar = $(`<div>`);

    const $toolbar = this.createToolbar();
    this.$calendar.append($toolbar);

    const $table = this.createTable();
    this.$calendar.append($table);

    this.container.empty();
    this.container.append(this.$calendar);

    let $tds = this.container.find("td");

    const $dropzones = this.container.find(".dropzone");
    this.$dropzones = $dropzones;

    this.renderEvents();

    $tds.on("click", function (e) {
      const event = Event.fromClick(calendar, this, e);

      calendar.dateClick?.(event);
    });

    $dropzones.on("dragenter", function (e) {
      e.preventDefault();
      $(this).addClass("drag-over");
    });

    $dropzones.on("dragover", function (e) {
      e.preventDefault();
    });

    $dropzones.on("dragleave", function () {
      $(this).removeClass("drag-over");
    });

    $dropzones.on("drop", function (e) {
      e.preventDefault();

      $(this).removeClass("drag-over");

      const id = e.originalEvent.dataTransfer.getData("text/plain");
      const $event = $("#" + id);
      $event.data("drop_target", e.target);
    });

    this.isRendered = true;
  }

  /**
   *
   * @return {jQuery}
   */
  createTable() {
    const $table = $("<table>")
      .addClass("table table-responsive table-hover")
      .css({
        tableLayout: "fixed",
      })
      .append(this.createHeader())
      .append(this.createBody());

    if (this.options.striping === Striping.ROWS) {
      $table.addClass("table-striped");
    }

    const $tableContainer = $("<div>")
      .addClass("overflow-y-scroll overflow-x-hidden")
      .css("height", "85vh")
      .append($table);

    const $col = $("<div>").addClass("col").append($tableContainer);

    return $("<div>").addClass("row").append($col);
  }

  /**
   * Creates the toolbar element
   * @returns {jQuery} The generated thead jQuery object.
   * @private
   */
  createToolbar() {
    const $toolbarRow = $(`
            <div class="row mb-2">
                <div class="rc-toolbar col d-flex justify-content-between">

                </div>
            </div>
        `);

    const $toolbar = $toolbarRow.children().first();

    const toolbarConfig = this.options.toolbar;

    for (const [key, value] of Object.entries(toolbarConfig)) {
      const $toolbarPart = $(`<div class="d-flex">`);
      let groups = value.split(" ");
      groups = groups.map((word) => word.split(","));
      for (const group of groups) {
        let $group;
        if (group.length > 1) {
          const $buttonGroup = $(`<div>`);
          for (const button of group) {
            $buttonGroup.append(this.createButton(this.buttons[button]));
          }
          $group = $buttonGroup;
        } else if (group.length === 1) {
          $group = this.createButton(this.buttons[group[0]]);
        } else {
          continue;
        }
        $toolbarPart.append($group);
      }
      if (key === "start") {
        $toolbarPart.children().addClass("me-1");
      } else if (key === "end") {
        $toolbarPart.children().addClass("ms-1");
      }
      $toolbar.append($toolbarPart);
    }

    return $toolbarRow;
  }

  createViewModeButtons() {
    const $viewmodeBtnDiv = $(`<div>`);
    const viewModes = ViewFactory.MODES;
    for (const viewmode in viewModes) {
      // todo: make this language independent, for now only on english
      const viewmodeTitle =
        String(viewmode).charAt(0).toUpperCase() + String(viewmode).slice(1);

      const iconHtml = viewModes[viewmode].buttonAttributes.iconHtml;

      const $viewmodeBtn = $(`
                <button title="${viewmodeTitle}" class="btn btn-dark">${iconHtml}</button>
            `).on("click", () => {
        this.setViewMode(viewmode);
        this.updateDates();
        this.render();
      });
      if (viewModes[viewmode].name === this.viewmode.name) {
        $viewmodeBtn.addClass("active");
      }
      $viewmodeBtnDiv.append($viewmodeBtn);
    }
    return $viewmodeBtnDiv;
  }

  createDateDisplay() {
    const headerText = this.viewmode.header(this.selectedDate);
    return $(`<span class="fw-bold fs-5">${headerText}</span>`);
  }

  createButton(button) {
    if (typeof button.creationFunction === "function") {
      return button.creationFunction();
    }

    const $button = $(`
            <button class="btn btn-dark">
        `).on("click", (event) => button.onClick(event));

    if (button.iconHtml) {
      $button.html(button.iconHtml);
    } else if (button.iconClass) {
      if (button.text) {
        $button.prop("title", button.text);
      }
      $button.append($(`<i class="${button.icon}"></i>`));
    } else if (button.text) {
      $button.text(button.text);
    }

    return $button;
  }

  createDateSelect() {
    return $(`
            <input
                    class="form-control me-1"
                    type="date"
                    value="${Utils.formatDateForInput(this.selectedDate)}">
        `).on("change", (event) => {
      const selectedDateString = event.target.value;
      const selectedDate = Temporal.PlainDate.from(
        selectedDateString,
      ).toPlainDateTime(Temporal.PlainTime.from("00:00:00"));
      this.selectDate(selectedDate);
    });
  }

  /**
   * Creates the table header (<thead>) element
   * @returns {jQuery} The generated thead jQuery object.
   * @private
   */
  createHeader() {
    const $thead = $("<thead>").css({
      position: "sticky",
      top: "0px",
      zIndex: 1000,
    });
    const $headerRow = $("<tr>");

    // First empty header cell (top-left corner)
    $headerRow.append(
      $("<th>").attr("scope", "col").attr("colspan", this.subdivision).css({
        width: "15vw",
        position: "sticky",
        top: "0px",
      }),
    );

    const today = Temporal.Now.plainDateTimeISO();
    this.todayIndex = null;

    // Date header cells
    $.each(this.dates, (index, date) => {
      const formattedDate = this.viewmode.formatDate(date);

      const $dateTh = $("<th>")
        .attr("scope", "col")
        .attr("colspan", this.subdivision)
        .css({
          position: "sticky",
          top: "0px",
        })
        .text(formattedDate);

      if (this.options.striping === Striping.COLUMNS && index % 2 === 0) {
        $dateTh.css(
          "box-shadow",
          "inset 0 0 0 9999px rgba(var(--bs-emphasis-color-rgb), 0.05)",
        );
      }

      if (this.options.nowIndicator) {
        if (this.viewmode.equalsUnit(today, date)) {
          $dateTh.addClass("bg-warning");
          this.todayIndex = index;
        }
      }

      $headerRow.append($dateTh);
    });
    $thead.append($headerRow);
    return $thead;
  }

  /**
   * Creates the table body (<tbody>) element
   * @returns {jQuery} The generated tbody jQuery object.
   * @private
   */
  createBody() {
    const $tbody = $("<tbody>");

    this.resources.forEach((resource, resourceId) => {
      const $resourceRow = $("<tr>");

      const $resourceTh = $("<th>")
        .addClass("p-1")
        .attr("scope", "row")
        .attr("colspan", this.subdivision)
        .css({
          width: "15vw",
        })
        .html(`${resource} (${resourceId})`);
      $resourceRow.append($resourceTh);
      for (let i = 0; i < this.dates.length; i++) {
        for (let j = 0; j < this.subdivision; j++) {
          const $resourceTd = $("<td>");
          if (this.todayIndex && i === this.todayIndex) {
            $resourceTd.addClass("bg-warning-subtle");
          }
          if (this.options.striping === Striping.COLUMNS && i % 2 === 0) {
            $resourceTd.css(
              "box-shadow",
              "inset 0 0 0 9999px rgba(var(--bs-emphasis-color-rgb), 0.05)",
            );
          }
          let borderStyle = j + 1 < this.subdivision ? "dashed" : "solid";
          $resourceTd.css({
            borderRight: `1px rgba(0, 0, 0, 0.3) ${borderStyle}`,
          });
          const $dropzoneDiv = $("<div>").addClass("dropzone w-100 h-100");
          $resourceTd.append($dropzoneDiv);
          $resourceRow.append($resourceTd);
        }
      }
      $resourceRow.data({
        resource_id: resourceId,
        height_index: 0,
      });

      $tbody.append($resourceRow);
      this.rows.set(resourceId, $resourceRow);
    });

    return $tbody;
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
