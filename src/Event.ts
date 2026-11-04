import { Temporal } from "temporal-polyfill";

import iconArrowRight from "./assets/chevron-right.svg?raw";
import iconArrowLeft from "./assets/chevron-left.svg?raw";

import { Utils } from "./utils";
import type { ResourceCalendar } from "./ResourceCalendar";

/**
 * Raw event data as supplied by the host's `fetchEventDataFunction`.
 */
export interface EventJSON {
  /** ISO date-time string, e.g. `"2026-05-22T09:00"` */
  start: string;
  /** ISO date-time string */
  end: string;
  /** id of the owning resource row */
  resourceId?: string | number;
  /** persistent event id */
  id?: string | number | null;
  title?: string;
  /** CSS color */
  backgroundColor?: string;
  /** extra HTML hooks */
  extendedProps?: { evtBeforeEvent?: string };
  allDay?: boolean;
}

/**
 * Wraps a single calendar event: owns its DOM element plus all
 * drag/resize/click listeners. Construct via the static factories
 * ({@link Event.new}, {@link Event.fromJSON}, {@link Event.fromClick}),
 * not `new` directly.
 */
export class Event {
  /**
   * Monotonic counter used to give every event element a unique DOM id.
   */
  static domIdCounter = 0;

  calendar: ResourceCalendar;
  startDate: Temporal.PlainDateTime;
  endDate: Temporal.PlainDateTime;
  resourceId: string;
  eventId: string | number | null;
  title: string;
  color: string;
  additionalEventHTML: string;
  allDay: boolean;
  /** controls vertical stacking of overlapping events */
  heightIndex: number;
  /** the event's DOM node, created by initiate() */
  element: HTMLElement | null;

  /**
   * Checked factory function. Returns `null` when the date range or resource
   * is invalid for the calendar's current view.
   */
  static new(
    calendar: ResourceCalendar,
    startDate: Temporal.PlainDateTime,
    endDate: Temporal.PlainDateTime,
    resourceId: string | null | undefined,
    eventId: string | number | null = null,
    title = "",
    color = "",
    additionalEventHTML = "",
    allDay = false,
  ): Event | null {
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
      resourceId as string,
      eventId,
      title,
      color,
      additionalEventHTML,
      allDay,
    );
  }

  /**
   * Prefer the static factories over calling this directly.
   */
  constructor(
    calendar: ResourceCalendar,
    startDate: Temporal.PlainDateTime,
    endDate: Temporal.PlainDateTime,
    resourceId: string,
    eventId: string | number | null = null,
    title = "",
    color = "",
    additionalEventHTML = "",
    allDay = false,
  ) {
    this.calendar = calendar;
    this.startDate = startDate;
    this.endDate = endDate;
    this.resourceId = resourceId;
    this.eventId = eventId;
    this.title = title ?? "";
    this.color = color ?? "";
    this.additionalEventHTML = additionalEventHTML ?? "";
    this.allDay = allDay ?? false;

    this.heightIndex = 0;

    this.element = null;
  }

  /**
   * Builds a new (unsaved) event from a click on a calendar cell.
   * @param startTd - the clicked `<td>`
   */
  static fromClick(
    calendar: ResourceCalendar,
    startTd: HTMLTableCellElement,
    e: MouseEvent,
  ): Event | null {
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
   */
  static fromJSON(calendar: ResourceCalendar, data: EventJSON): Event | null {
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
   */
  initiate(): void {
    if (this.element) {
      this.remove();
    }

    const template = document.createElement("div");
    template.innerHTML = `
      <div
          draggable="${this.calendar.options.editable}"
          class="rc-event">
          ${this.additionalEventHTML}
          <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"></span>
          <div class="resize-handle handle-start"></div>
          <div class="resize-handle handle-end"></div>
      </div>
    `;
    const element = template.firstElementChild as HTMLElement;

    element.id = `rc-event-${++Event.domIdCounter}`;
    element._eventId = this.eventId;
    element._event = this;

    this.calendar.events.add(this);

    const event = this;

    let isResizing = false;
    let startX = 0;
    let startSnapshot: Temporal.PlainDateTime;
    let endSnapshot: Temporal.PlainDateTime;

    const resizeHandleStart =
      element.querySelector<HTMLElement>(".handle-start");
    const resizeHandleEnd = element.querySelector<HTMLElement>(".handle-end");

    if (resizeHandleStart) {
      resizeHandleStart.addEventListener("mousedown", (e) =>
        handleMouseDown(e, true, resizeHandleStart),
      );
    }
    if (resizeHandleEnd) {
      resizeHandleEnd.addEventListener("mousedown", (e) =>
        handleMouseDown(e, false, resizeHandleEnd),
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

    element.addEventListener("dragstart", (e) => {
      this.calendar._drag = { event: this, startX: e.clientX };
      element._dropTarget = null;
      e.dataTransfer?.setData("text/plain", element.id);

      setTimeout(() => {
        element.style.opacity = "0.5";
        element.style.cursor = "grabbing";
        this.calendar.calendarEl.classList.add("rc-dragging");
      }, 0);
    });

    element.addEventListener("dragend", (e) => {
      element.style.opacity = "1";
      element.style.cursor = "grab";
      this.calendar.calendarEl.classList.remove("rc-dragging");
      this.calendar.clearDropHighlight();

      const dropTarget = element._dropTarget;
      const dragStartX = this.calendar._drag?.startX ?? e.clientX;
      this.calendar._drag = null;

      if (dropTarget) {
        const draggedDistanceX = e.clientX - dragStartX;
        const newTr = dropTarget.closest("tr");
        const movedSubdivisions = Math.round(
          draggedDistanceX / this.calendar.tdWidth,
        );
        this.moveBySubdivisions(movedSubdivisions, newTr);
        event.save();
        this.calendar.eventDrop?.(this);
      }

      delete element._dropTarget;
    });

    // Store references so they can be removed if needed
    let resizeStart = true;

    /**
     * @param isStart - true for the start handle, false for the end
     * @param handle - the handle element being dragged
     */
    function handleMouseDown(
      e: MouseEvent,
      isStart: boolean,
      handle: HTMLElement,
    ): void {
      if (
        !event.calendar.options.editable ||
        handle.classList.contains("overflow-handle")
      ) {
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

    function onMouseMove(e: MouseEvent): void {
      e.preventDefault();
      e.stopPropagation();
      if (!isResizing) return;

      const currentX = e.clientX;
      const diffX = currentX - startX;
      const movedSubdivisions = Math.round(diffX / event.calendar.tdWidth);

      event.resizeBySubdivisions(
        movedSubdivisions,
        startSnapshot,
        endSnapshot,
        resizeStart,
      );
    }

    function onMouseUp(e: MouseEvent): void {
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
   */
  renderPartial(): void {
    if (!this.element) {
      this.initiate();
    }

    this.renderUpdate();
    this.renderDetailUpdates();
  }

  /**
   * Renders the event and restacks its row.
   */
  render(): void {
    this.renderPartial();
    this.updateRow();
  }

  /**
   * Swaps resize handles for overflow arrows when the event extends beyond
   * the visible date range, and back again when it does not.
   */
  toggleOverflowHandles(): void {
    const element = this.element;
    if (!element) {
      return;
    }
    const manageHandle = (
      handleClass: string,
      overflowIcon: string,
      overflowCondition: boolean,
    ): void => {
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
        handle.replaceChildren();
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
   * @param newTr - target resource row, if changed
   */
  moveBySubdivisions(
    movedSubdivisions: number,
    newTr: HTMLTableRowElement | null = null,
  ): void {
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
   * @param startSnapshot - start date when resize began
   * @param endSnapshot - end date when resize began
   * @param resizeStart - if true resize the start edge, else the end
   */
  resizeBySubdivisions(
    movedSubdivisions: number,
    startSnapshot: Temporal.PlainDateTime,
    endSnapshot: Temporal.PlainDateTime,
    resizeStart = true,
  ): void {
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
   */
  detach(): void {
    if (!this.element) {
      // dom event doesnt exist
      return;
    }
    this.element.parentNode?.removeChild(this.element);
  }

  /**
   * Removes the event element from the DOM and restacks its old row.
   */
  remove(): void {
    this.calendar.events.delete(this);

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
   * The date range the event occupies on screen: its own dates, or the whole
   * days it spans when it is an all-day event.
   */
  displayRange(): {
    start: Temporal.PlainDateTime;
    end: Temporal.PlainDateTime;
  } {
    if (!this.allDay) {
      return { start: this.startDate, end: this.endDate };
    }

    const midnight = { hour: 0, minute: 0, second: 0, millisecond: 0 };
    return {
      start: this.startDate.with(midnight),
      end: this.endDate.add({ days: 1 }).with(midnight),
    };
  }

  /**
   * Positions and sizes the event element horizontally to match its dates.
   */
  updatePositionAndWidth(): void {
    const { start, end } = this.displayRange();

    const diffXStart = this.calendar.getBoundedDiffXFromDate(start);
    const diffXEnd = this.calendar.getBoundedDiffXFromDate(end);

    if (!this.element) {
      return;
    }
    this.element.style.left = diffXStart + "px";
    this.element.style.width = diffXEnd - diffXStart + "px";
  }

  /**
   * Appends the event element into the cell of its current resource row.
   */
  moveToCorrectResource(): void {
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
   */
  getRow(): HTMLTableRowElement | undefined {
    return this.calendar.rows.get(this.resourceId);
  }

  /**
   * Recomputes overlap stacking for this event's row.
   */
  updateRow(): void {
    Event.updateRow(this.getRow());
  }

  /**
   * Recomputes vertical stacking of overlapping events in a row and resizes
   * the row to fit them.
   */
  static updateRow(tr: HTMLTableRowElement | null | undefined): void {
    if (!tr) {
      return;
    }

    const td = tr.querySelector("td");
    if (!td) {
      return;
    }

    const eventElements = Array.from(
      td.querySelectorAll<HTMLElement>(".rc-event"),
    );

    const allEvents = eventElements
      .map((el) => el._event)
      .filter((event): event is Event => !!event);
    allEvents.sort((a, b) => {
      const startCmp = Temporal.PlainDateTime.compare(a.startDate, b.startDate);
      if (startCmp !== 0) return startCmp;
      return Temporal.PlainDateTime.compare(a.endDate, b.endDate);
    });

    const processedEvents: Event[] = [];
    let maxHeightIndex = 0;

    const eventsOverlap = (eventA: Event, eventB: Event): boolean => {
      return (
        Temporal.PlainDateTime.compare(eventA.startDate, eventB.endDate) < 0 &&
        Temporal.PlainDateTime.compare(eventA.endDate, eventB.startDate) > 0
      );
    };

    allEvents.forEach((currentEvent) => {
      const occupiedIndices = new Set<number>();

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
   */
  renderUpdate(): void {
    this.toggleOverflowHandles();
    this.detach();
    this.updatePositionAndWidth();
    this.moveToCorrectResource();
  }

  /**
   * Re-renders title and color. Only called when the event is edited via the
   * detail modal, not on resize/move.
   */
  renderDetailUpdates(): void {
    this.updateTitle();
    this.updateColor();
  }

  /**
   * Shifts the element down to its `heightIndex` to make room for
   * overlapping events.
   */
  shiftToIndex(): void {
    if (!this.element) {
      return;
    }
    this.heightIndex = Math.max(0, this.heightIndex);
    this.element.style.top =
      this.heightIndex * this.element.offsetHeight + "px";
  }

  setStartDate(newDate: Temporal.PlainDateTime): void {
    this.startDate = newDate;
  }

  setEndDate(newDate: Temporal.PlainDateTime): void {
    this.endDate = newDate;
  }

  setTitle(newTitle: string): void {
    this.title = newTitle;
  }

  /**
   * @param newColor - falls back to the calendar's default color
   */
  setColor(newColor: string | null): void {
    this.color = newColor ?? this.calendar.options.defaultEventColor;
  }

  setAllDay(allDay: boolean): void {
    this.allDay = allDay ?? false;
  }

  /**
   * Writes the title onto the element (text and `title` attribute).
   */
  updateTitle(): void {
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
   */
  updateColor(): void {
    if (!this.element) {
      return;
    }
    if (!this.color) {
      this.element.style.removeProperty("background-color");
      this.element.style.removeProperty("border-color");
      this.element.style.removeProperty("color");
      return;
    }
    this.element.style.backgroundColor = this.color;
    this.element.style.borderColor = Utils.shadeColor(this.color, 1.1);
    this.element.style.color = Utils.getContrastYIQ(this.color);
  }

  /**
   * Hands the event to the host's `saveEventFunction`, if one was provided.
   */
  save(): void {
    this.calendar.saveEventFunction?.(this);
  }

  /**
   * Hands the event to the host's `deleteEventFunction`, if one was provided,
   * then drops it from the calendar.
   */
  delete(): void {
    this.calendar.deleteEventFunction?.(this);
    this.remove();
  }
}
