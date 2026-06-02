import "./style.css";
import { Temporal } from "temporal-polyfill";

import iconArrowRight from "./assets/chevron-right.svg?raw";
import iconArrowLeft from "./assets/chevron-left.svg?raw";

import { Utils } from "./utils";

/**
 * @typedef {import("./ResourceCalendar").ResourceCalendar} ResourceCalendar
 */

/**
 * Raw event data as supplied by the host's `fetchEventDataFunction`.
 * @typedef {object} EventJSON
 * @property {string} start - ISO date-time string, e.g. `"2026-05-22T09:00"`
 * @property {string} end - ISO date-time string
 * @property {string|number} [resourceId] - id of the owning resource row
 * @property {string|number|null} [id] - persistent event id
 * @property {string} [title]
 * @property {string} [backgroundColor] - CSS color
 * @property {{ evtBeforeEvent?: string }} [extendedProps] - extra HTML hooks
 * @property {boolean} [allDay]
 */

/**
 * Wraps a single calendar event: owns its DOM element plus all
 * drag/resize/click listeners. Construct via the static factories
 * ({@link Event.new}, {@link Event.fromJSON}, {@link Event.fromClick}),
 * not `new` directly.
 */
export class Event {
  /**
   * Monotonic counter used to give every event element a unique DOM id.
   * @type {number}
   */
  static domIdCounter = 0;

  /**
   * Checked factory function. Returns `null` when the date range or resource
   * is invalid for the calendar's current view.
   * @param {ResourceCalendar} calendar
   * @param {Temporal.PlainDateTime} startDate
   * @param {Temporal.PlainDateTime} endDate
   * @param {string|null|undefined} resourceId
   * @param {string|number|null} [eventId]
   * @param {string} [title]
   * @param {string} [color]
   * @param {string} [additionalEventHTML]
   * @param {boolean} [allDay]
   * @returns {Event|null}
   */
  static new(
    calendar,
    startDate,
    endDate,
    resourceId,
    eventId = null,
    title = "",
    color = "",
    additionalEventHTML = "",
    allDay = false,
  ) {
    if (
      !calendar.verifyDateValidity(startDate, endDate) ||
      !calendar.verifyResource(resourceId)
    ) {
      return null;
    }
    return new Event(
      calendar,
      startDate,
      endDate,
      /** @type {string} */ (resourceId),
      eventId,
      title,
      color,
      additionalEventHTML,
      allDay,
    );
  }

  /**
   * Prefer the static factories over calling this directly.
   * @param {ResourceCalendar} calendar
   * @param {Temporal.PlainDateTime} startDate
   * @param {Temporal.PlainDateTime} endDate
   * @param {string} resourceId
   * @param {string|number|null} [eventId]
   * @param {string} [title]
   * @param {string} [color]
   * @param {string} [additionalEventHTML]
   * @param {boolean} [allDay]
   */
  constructor(
    calendar,
    startDate,
    endDate,
    resourceId,
    eventId = null,
    title = "",
    color = "",
    additionalEventHTML = "",
    allDay = false,
  ) {
    /** @type {ResourceCalendar} */
    this.calendar = calendar;
    /** @type {Temporal.PlainDateTime} */
    this.startDate = startDate;
    /** @type {Temporal.PlainDateTime} */
    this.endDate = endDate;
    /** @type {string} */
    this.resourceId = resourceId;
    /** @type {string|number|null} */
    this.eventId = eventId;
    /** @type {string} */
    this.title = title ?? "";
    /** @type {string} */
    this.color = color ?? "";
    /** @type {string} */
    this.additionalEventHTML = additionalEventHTML ?? "";
    /** @type {boolean} */
    this.allDay = allDay ?? false;

    /** @type {number} controls vertical stacking of overlapping events */
    this.heightIndex = 0;

    /** @type {HTMLElement|null} the event's DOM node, created by initiate() */
    this.element = null;
  }

  /**
   * Builds a new (unsaved) event from a click on a calendar cell.
   * @param {ResourceCalendar} calendar
   * @param {HTMLTableCellElement} startTd - the clicked `<td>`
   * @param {MouseEvent} e
   * @returns {Event|null}
   */
  static fromClick(calendar, startTd, e) {
    const startTr = startTd.closest("tr");
    if (!startTr) {
      return null;
    }
    const firstTd = startTr.querySelector("td");
    if (!firstTd) {
      return null;
    }
    const clickX = e.clientX;
    const tdOffset = firstTd.getBoundingClientRect().left;
    const diffX = clickX - tdOffset;
    const snappedWidth = Utils.floorToMultiple(diffX, calendar.tdWidth);

    const startDate = calendar.getDateFromDiffX(snappedWidth);
    const endDate = calendar.getNextDate(startDate);
    const resourceId = startTr.dataset.resource_id;
    const eventId = null;
    const title = "";
    const color = calendar.options.defaultEventColor;
    const allDay = false;

    return Event.new(
      calendar,
      startDate,
      endDate,
      resourceId,
      eventId,
      title,
      color,
      undefined,
      allDay,
    );
  }

  /**
   * Builds an event from host-supplied JSON.
   * @param {ResourceCalendar} calendar
   * @param {EventJSON} data
   * @returns {Event|null}
   */
  static fromJSON(calendar, data) {
    const startDate = Temporal.PlainDateTime.from(data.start);
    const endDate = Temporal.PlainDateTime.from(data.end);
    const resourceId = data.resourceId?.toString() ?? null;
    const eventId = data.id ?? null;
    const title = data.title ?? "";
    const color = data.backgroundColor ?? calendar.options.defaultEventColor;
    const additionalEventHTML = data.extendedProps?.evtBeforeEvent ?? "";
    const allDay = data.allDay ?? false;

    return Event.new(
      calendar,
      startDate,
      endDate,
      resourceId,
      eventId,
      title,
      color,
      additionalEventHTML,
      allDay,
    );
  }

  /**
   * Creates the event's DOM element and wires up its drag/resize/click
   * listeners. Note: this re-creates the element if it already exists.
   * @returns {void}
   */
  initiate() {
    if (this.element) {
      this.remove();
    }

    const template = document.createElement("div");
    template.innerHTML = `
      <div
          draggable="true"
          class="rc-event">
          ${this.additionalEventHTML}
          <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"></span>
          <div class="resize-handle handle-start"></div>
          <div class="resize-handle handle-end"></div>
      </div>
    `;
    const element = /** @type {HTMLElement} */ (template.firstElementChild);

    element.id = `rc-event-${++Event.domIdCounter}`;
    element._eventId = this.eventId;
    element._event = this;

    const event = this;

    /** @type {boolean} */
    let isResizing = false;
    /** @type {number} */
    let startX = 0;
    /** @type {Temporal.PlainDateTime} */
    let startSnapshot;
    /** @type {Temporal.PlainDateTime} */
    let endSnapshot;

    const resizeHandleStart = /** @type {HTMLElement|null} */ (
      element.querySelector(".handle-start")
    );
    const resizeHandleEnd = /** @type {HTMLElement|null} */ (
      element.querySelector(".handle-end")
    );

    if (resizeHandleStart) {
      resizeHandleStart.addEventListener("mousedown", (e) =>
        handleMouseDown(/** @type {MouseEvent} */ (e), true, resizeHandleStart),
      );
    }
    if (resizeHandleEnd) {
      resizeHandleEnd.addEventListener("mousedown", (e) =>
        handleMouseDown(/** @type {MouseEvent} */ (e), false, resizeHandleEnd),
      );
    }

    element.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isResizing) {
        isResizing = false;
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      this.calendar.eventClick?.(this);
    });

    /** @type {number} */
    let dragStartX = 0;

    element.addEventListener("dragstart", (e) => {
      dragStartX = e.clientX;
      element._dropTarget = null;
      e.dataTransfer?.setData("text/plain", element.id);

      setTimeout(() => {
        element.style.opacity = "0.5";
        element.style.cursor = "grabbing";
        this.calendar.dropzones.forEach((dz) => (dz.style.zIndex = "1000"));
      }, 0);
    });

    element.addEventListener("dragend", (e) => {
      element.style.opacity = "1";
      element.style.cursor = "grab";
      this.calendar.dropzones.forEach((dz) => dz.classList.remove("drag-over"));

      const dropTarget = element._dropTarget;

      if (dropTarget) {
        const draggedDistanceX = e.clientX - dragStartX;
        const newTr = dropTarget.closest("tr");
        const movedSubdivisions = Math.round(
          draggedDistanceX / this.calendar.tdWidth,
        );
        this.moveBySubdivisions(movedSubdivisions, newTr);
        event.save();
      }

      event.calendar.dropzones.forEach((dz) => (dz.style.zIndex = "-1"));
      delete element._dropTarget;
    });

    // Store references so they can be removed if needed
    /** @type {boolean} */
    let resizeStart = true;

    /**
     * @param {MouseEvent} e
     * @param {boolean} isStart - true for the start handle, false for the end
     * @param {HTMLElement} handle - the handle element being dragged
     */
    function handleMouseDown(e, isStart, handle) {
      if (handle.classList.contains("overflow-handle")) {
        return;
      }
      isResizing = true;
      resizeStart = isStart;
      startX = e.clientX;
      startSnapshot = event.startDate;
      endSnapshot = event.endDate;
      element.classList.add("resizing");

      e.preventDefault();
      e.stopPropagation();

      document.body.style.cursor = "ew-resize";

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    /** @param {MouseEvent} e */
    function onMouseMove(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!isResizing) return;

      const currentX = e.clientX;
      const diffX = currentX - startX;
      let movedSubdivisions = Math.round(diffX / event.calendar.tdWidth);

      event.resizeBySubdivisions(
        movedSubdivisions,
        startSnapshot,
        endSnapshot,
        resizeStart,
      );
    }

    /** @param {MouseEvent} e */
    function onMouseUp(e) {
      e.preventDefault();
      e.stopPropagation();

      if (isResizing) {
        element.classList.remove("resizing");
        document.body.style.cursor = "default";

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        event.save();
      }
    }

    this.element = element;
  }

  /**
   * Renders the event in the DOM (creating the element on first call).
   * Does not restack the row — call {@link Event#updateRow} afterwards.
   * @returns {void}
   */
  renderPartial() {
    if (!this.element) {
      this.initiate();
    }

    this.renderUpdate();
    this.renderDetailUpdates();
  }

  /**
   * Renders the event and restacks its row.
   * @returns {void}
   */
  render() {
    this.renderPartial();
    this.updateRow();
  }

  /**
   * Swaps resize handles for overflow arrows when the event extends beyond
   * the visible date range, and back again when it does not.
   * @returns {void}
   */
  toggleOverflowHandles() {
    const element = this.element;
    if (!element) {
      return;
    }
    /**
     * @param {string} handleClass
     * @param {string} overflowIcon
     * @param {boolean} overflowCondition
     */
    const manageHandle = (handleClass, overflowIcon, overflowCondition) => {
      const handle = element.querySelector(`.${handleClass}`);
      if (!handle) {
        return;
      }
      if (overflowCondition && handle.classList.contains("resize-handle")) {
        handle.classList.remove("resize-handle");
        handle.classList.add("overflow-handle");
        const iconTemplate = document.createElement("div");
        iconTemplate.innerHTML = overflowIcon;
        if (iconTemplate.firstElementChild) {
          handle.append(iconTemplate.firstElementChild);
        }
      } else if (
        !overflowCondition &&
        handle.classList.contains("overflow-handle")
      ) {
        handle.classList.remove("overflow-handle");
        handle.classList.add("resize-handle");
        const icon = handle.querySelector("i");
        if (icon) icon.remove();
      }
    };

    manageHandle(
      "handle-start",
      iconArrowLeft,
      Temporal.PlainDateTime.compare(this.startDate, this.calendar.startDate) <
        0,
    );

    manageHandle(
      "handle-end",
      iconArrowRight,
      Temporal.PlainDateTime.compare(this.endDate, this.calendar.endDate) > 0,
    );
  }

  /**
   * Moves the event by a whole number of grid columns, optionally onto a
   * different resource row.
   * @param {number} movedSubdivisions
   * @param {HTMLTableRowElement|null} [newTr] - target resource row, if changed
   * @returns {void}
   */
  moveBySubdivisions(movedSubdivisions, newTr = null) {
    const timeOffset = this.calendar.subdivisionsToTime(movedSubdivisions);
    const previousRow = this.getRow();

    let sameRow = false;
    if (newTr !== null) {
      const newId = newTr.dataset.resource_id;
      if (newId !== undefined) {
        if (this.resourceId === newId) {
          sameRow = true;
        }
        this.resourceId = newId;
      }
    }
    this.setStartDate(this.startDate.add({ milliseconds: timeOffset }));
    this.setEndDate(this.endDate.add({ milliseconds: timeOffset }));
    this.renderUpdate();
    if (!sameRow) {
      Event.updateRow(previousRow);
    }
    this.updateRow();
  }

  /**
   * Resizes the event's start or end edge by a whole number of grid columns.
   * @param {number} movedSubdivisions
   * @param {Temporal.PlainDateTime} startSnapshot - start date when resize began
   * @param {Temporal.PlainDateTime} endSnapshot - end date when resize began
   * @param {boolean} [resizeStart] - if true resize the start edge, else the end
   * @returns {void}
   */
  resizeBySubdivisions(
    movedSubdivisions,
    startSnapshot,
    endSnapshot,
    resizeStart = true,
  ) {
    const timeOffset = this.calendar.subdivisionsToTime(movedSubdivisions);
    const dayView = this.calendar.viewmode.name === "day";

    if (resizeStart) {
      // resize at Start
      const base = dayView
        ? startSnapshot
        : this.calendar.snapToGrid(startSnapshot, "ceil");
      const newStart = base.add({ milliseconds: timeOffset });
      if (Temporal.PlainDateTime.compare(newStart, this.endDate) >= 0) {
        return;
      }
      this.setStartDate(newStart);
    } else {
      // resize at End
      const base = dayView
        ? endSnapshot
        : this.calendar.snapToGrid(endSnapshot, "ceil");
      const newEnd = base.add({ milliseconds: timeOffset });
      if (Temporal.PlainDateTime.compare(newEnd, this.startDate) <= 0) {
        return;
      }
      this.setEndDate(newEnd);
    }
    this.renderUpdate();
    this.updateRow();
  }

  /**
   * Safely detaches the event element from the DOM so it can be re-placed.
   * @returns {void}
   */
  detach() {
    if (!this.element) {
      // dom event doesnt exist
      return;
    }
    this.element.parentNode?.removeChild(this.element);
  }

  /**
   * Removes the event element from the DOM and restacks its old row.
   * @returns {void}
   */
  remove() {
    if (!this.element) {
      // dom event doesnt exist
      return;
    }

    const prevTr = this.element.closest("tr");

    this.element.remove();
    this.element = null;

    Event.updateRow(prevTr);
  }

  /**
   * Positions and sizes the event element horizontally to match its dates.
   * @returns {void}
   */
  updatePositionAndWidth() {
    let endDate = this.endDate;
    let startDate = this.startDate;
    if (this.allDay) {
      startDate = startDate.with({
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      endDate = endDate
        .add({ days: 1 })
        .with({ hour: 0, minute: 0, second: 0, millisecond: 0 });
    }

    let diffXStart = this.calendar.getBoundedDiffXFromDate(startDate);
    let diffXEnd = this.calendar.getBoundedDiffXFromDate(endDate);

    if (!this.element) {
      return;
    }
    this.element.style.left = diffXStart + "px";
    this.element.style.width = diffXEnd - diffXStart + "px";
  }

  /**
   * Appends the event element into the cell of its current resource row.
   * @returns {void}
   */
  moveToCorrectResource() {
    const tr = this.getRow();
    if (!tr || !this.element) {
      return;
    }
    const td = tr.querySelector("td");
    if (!td) {
      return;
    }

    this.element.style.top = "0px";

    td.append(this.element);
  }

  /**
   * The table row for this event's resource.
   * @returns {HTMLTableRowElement|undefined}
   */
  getRow() {
    return this.calendar.rows.get(this.resourceId);
  }

  /**
   * Recomputes overlap stacking for this event's row.
   * @returns {void}
   */
  updateRow() {
    Event.updateRow(this.getRow());
  }

  /**
   * Recomputes vertical stacking of overlapping events in a row and resizes
   * the row to fit them.
   * @param {HTMLTableRowElement|null|undefined} tr
   * @returns {void}
   */
  static updateRow(tr) {
    if (!tr) {
      return;
    }

    const td = tr.querySelector("td");
    if (!td) {
      return;
    }

    const eventElements = /** @type {HTMLElement[]} */ (
      Array.from(td.querySelectorAll(".rc-event"))
    );

    const allEvents = /** @type {Event[]} */ (
      eventElements.map((el) => el._event).filter(Boolean)
    );
    allEvents.sort((a, b) => {
      const startCmp = Temporal.PlainDateTime.compare(a.startDate, b.startDate);
      if (startCmp !== 0) return startCmp;
      return Temporal.PlainDateTime.compare(a.endDate, b.endDate);
    });

    /** @type {Event[]} */
    const processedEvents = [];
    let maxHeightIndex = 0;

    /**
     * @param {Event} eventA
     * @param {Event} eventB
     * @returns {boolean}
     */
    const eventsOverlap = (eventA, eventB) => {
      return (
        Temporal.PlainDateTime.compare(eventA.startDate, eventB.endDate) < 0 &&
        Temporal.PlainDateTime.compare(eventA.endDate, eventB.startDate) > 0
      );
    };

    allEvents.forEach((currentEvent) => {
      const occupiedIndices = new Set();

      processedEvents.forEach((placedEvent) => {
        if (eventsOverlap(currentEvent, placedEvent)) {
          occupiedIndices.add(placedEvent.heightIndex);
        }
      });

      let newHeightIndex = 0;
      while (occupiedIndices.has(newHeightIndex)) {
        newHeightIndex++;
      }

      currentEvent.heightIndex = newHeightIndex;
      processedEvents.push(currentEvent);

      if (newHeightIndex > maxHeightIndex) {
        maxHeightIndex = newHeightIndex;
      }
    });

    // trIndex is used to avoid expensive reflow
    const trIndex = tr._heightIndex ?? 0;
    if (eventElements.length > 0) {
      if (trIndex !== maxHeightIndex) {
        const singleEventHeight = eventElements[0].offsetHeight;
        tr.style.height = (maxHeightIndex + 2) * singleEventHeight + "px";
        tr._heightIndex = maxHeightIndex;
      }
    } else {
      if (trIndex > 0) {
        tr.style.height = "0px";
        tr._heightIndex = 0;
      }
    }

    allEvents.forEach((event) => {
      event.shiftToIndex();
    });
  }

  /**
   * Re-renders the event's geometry (handles, position, resource row).
   * @returns {void}
   */
  renderUpdate() {
    this.toggleOverflowHandles();
    this.detach();
    this.updatePositionAndWidth();
    this.moveToCorrectResource();
  }

  /**
   * Re-renders title and color. Only called when the event is edited via the
   * detail modal, not on resize/move.
   * @returns {void}
   */
  renderDetailUpdates() {
    this.updateTitle();
    this.updateColor();
  }

  /**
   * Shifts the element down to its `heightIndex` to make room for
   * overlapping events.
   * @returns {void}
   */
  shiftToIndex() {
    if (!this.element) {
      return;
    }
    this.heightIndex = Math.max(0, this.heightIndex);
    this.element.style.top =
      this.heightIndex * this.element.offsetHeight + "px";
  }

  /**
   * @param {Temporal.PlainDateTime} newDate
   * @returns {void}
   */
  setStartDate(newDate) {
    this.startDate = newDate;
  }

  /**
   * @param {Temporal.PlainDateTime} newDate
   * @returns {void}
   */
  setEndDate(newDate) {
    this.endDate = newDate;
  }

  /**
   * @param {string} newTitle
   * @returns {void}
   */
  setTitle(newTitle) {
    this.title = newTitle;
  }

  /**
   * @param {string|null} newColor - falls back to the calendar's default color
   * @returns {void}
   */
  setColor(newColor) {
    this.color = newColor ?? this.calendar.options.defaultEventColor;
  }

  /**
   * @param {boolean} allDay
   * @returns {void}
   */
  setAllDay(allDay) {
    this.allDay = allDay ?? false;
  }

  /**
   * Writes the title onto the element (text and `title` attribute).
   * @returns {void}
   */
  updateTitle() {
    if (!this.element) {
      return;
    }
    this.element.setAttribute("title", this.title);
    const span = this.element.querySelector("span");
    if (span) {
      span.textContent = this.title;
    }
  }

  /**
   * Writes the color (background, border, contrasting text) onto the element.
   * @returns {void}
   */
  updateColor() {
    if (!this.element) {
      return;
    }
    this.element.style.backgroundColor = this.color;
    this.element.style.borderColor = Utils.shadeColor(this.color, 1.1);
    this.element.style.color = Utils.getContrastYIQ(this.color);
  }

  /**
   * Hands the event to the host's `saveEventFunction`, if one was provided.
   * @returns {void}
   */
  save() {
    this.calendar.saveEventFunction?.(this);
  }

  /**
   * Hands the event to the host's `deleteEventFunction`, if one was provided.
   * @returns {void}
   */
  delete() {
    this.calendar.deleteEventFunction?.(this);
  }
}
