import "./style.css";
import { Temporal } from "temporal-polyfill";

import iconArrowRight from "./assets/chevron-right.svg?raw";
import iconArrowLeft from "./assets/chevron-left.svg?raw";

import { Utils } from "./utils";

export class Event {
  /**
   * checked factory function, returns null if invalid date was entered
   * @param {import("./index").ResourceCalendar} calendar
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {string} resourceId
   * @param {string|null} eventId
   * @param {string} title
   * @param {string} color
   * @param {string} additionalEventHTML
   * @param {boolean} allDay
   * @return {Event|null}
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
      resourceId,
      eventId,
      title,
      color,
      additionalEventHTML,
      allDay,
    );
  }

  /**
   *
   * @param {ResourceCalendar} calendar
   * @param {Date} startDate
   * @param {Date} endDate
   * @param {string} resourceId
   * @param {string|null} eventId
   * @param {string} title
   * @param {string} color
   * @param {string} additionalEventHTML
   * @param {boolean} allDay
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
    this.calendar = calendar;
    this.startDate = startDate;
    this.endDate = endDate;
    this.resourceId = resourceId;
    this.eventId = eventId;
    this.title = title ?? "";
    this.color = color ?? "";
    this.additionalEventHTML = additionalEventHTML ?? "";
    this.allDay = allDay ?? false;

    this.heightIndex = 0; // heightIndex controls overlapping events
  }

  static fromClick(calendar, startTd, e) {
    const startTr = startTd.closest("tr");
    const firstTd = startTr.querySelector("td");
    const clickX = e.clientX;
    const tdOffset = firstTd.getBoundingClientRect().left;
    const diffX = clickX - tdOffset;
    const snappedWidth = Utils.findSmallestEquidistantValue(
      diffX,
      calendar.tdWidth,
    );

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
   * initiate the event in the dom. note: this rerenders the event if it is already rendered
   */
  initiate() {
    if (this.element) {
      this.remove();
    }

    const template = document.createElement("div");
    template.innerHTML = `
      <div
          id="event-${this.eventId}"
          draggable="true"
          class="rc-event d-flex justify-content-center align-items-center">
          ${this.additionalEventHTML}
          <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"></span>
          <div class="resize-handle handle-start d-flex justify-content-center align-items-center"></div>
          <div class="resize-handle handle-end d-flex justify-content-center align-items-center"></div>
      </div>
    `;
    const element = template.firstElementChild;

    element._eventId = this.eventId;
    element._event = this;

    const event = this;

    let isResizing;
    let startX;
    let startTime;
    let endTime;

    const resizeHandleStart = element.querySelector(".handle-start");
    const resizeHandleEnd = element.querySelector(".handle-end");

    resizeHandleStart.addEventListener("mousedown", (e) =>
      handleMouseDown(e, true, resizeHandleStart),
    );
    resizeHandleEnd.addEventListener("mousedown", (e) =>
      handleMouseDown(e, false, resizeHandleEnd),
    );

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

    let dragStartX;

    element.addEventListener("dragstart", (e) => {
      dragStartX = e.clientX;
      element._dropTarget = null;
      e.dataTransfer.setData("text/plain", element.id);

      setTimeout(() => {
        element.style.opacity = "0.5";
        element.style.cursor = "grabbing";
        this.calendar.dropzones.forEach((dz) => (dz.style.zIndex = 1000));
      }, 0);
    });

    element.addEventListener("dragend", (e) => {
      element.style.opacity = "1";
      element.style.cursor = "grab";
      this.calendar.dropzones.forEach((dz) => dz.classList.remove("drag-over"));

      const dropTarget = element._dropTarget;

      if (dropTarget !== null) {
        const draggedDistanceX = e.clientX - dragStartX;
        const newTr = dropTarget.closest("tr");
        const movedSubdivisions = Math.round(
          draggedDistanceX / this.calendar.tdWidth,
        );
        this.moveBySubdivisions(movedSubdivisions, newTr);
        event.save();
      }

      event.calendar.dropzones.forEach((dz) => (dz.style.zIndex = -1));
      delete element._dropTarget;
    });

    function handleMouseDown(e, resizeStart, handle) {
      if (handle.classList.contains("overflow-handle")) {
        return;
      }
      isResizing = true;
      startX = e.clientX;
      startTime = event.startDate.toZonedDateTime(
        Temporal.Now.timeZoneId(),
      ).epochMilliseconds;
      endTime = event.endDate.toZonedDateTime(
        Temporal.Now.timeZoneId(),
      ).epochMilliseconds;
      element.classList.add("resizing");

      e.preventDefault();
      e.stopPropagation();

      document.body.style.cursor = "ew-resize";

      document.addEventListener("mousemove", handleMouseMoveResizing);
      document.addEventListener("mouseup", handleMouseUpResizing);
    }

    function handleMouseMoveResizing(e) {
      handleMouseMove(e, resizeStart);
    }

    function handleMouseUpResizing(e) {
      handleMouseUp(e);
    }

    // Store references so they can be removed if needed
    let resizeStart;

    function handleMouseDown(e, isStart, handle) {
      if (handle.classList.contains("overflow-handle")) {
        return;
      }
      isResizing = true;
      resizeStart = isStart;
      startX = e.clientX;
      startTime = event.startDate.toZonedDateTime(
        Temporal.Now.timeZoneId(),
      ).epochMilliseconds;
      endTime = event.endDate.toZonedDateTime(
        Temporal.Now.timeZoneId(),
      ).epochMilliseconds;
      element.classList.add("resizing");

      e.preventDefault();
      e.stopPropagation();

      document.body.style.cursor = "ew-resize";

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!isResizing) return;

      const currentX = e.clientX;
      const diffX = currentX - startX;
      let movedSubdivisions = Math.round(diffX / event.calendar.tdWidth);

      event.resizeBySubdivisions(
        movedSubdivisions,
        startTime,
        endTime,
        resizeStart,
      );
    }

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
   * render the event in the dom. if render() was already called, just update dom attributes
   * This does not update the rendering in the row, call event.updateRow() after
   */
  renderPartial() {
    if (!this.element) {
      this.initiate();
    }

    this.renderUpdate();
    this.renderDetailUpdates();
  }

  /**
   * render the event in the dom. if render() was already called, just update dom attributes
   */
  render() {
    this.renderPartial();
    this.updateRow();
  }

  toggleOverflowHandles() {
    const manageHandle = (handleClass, overflowIcon, overflowCondition) => {
      const handle = this.element.querySelector(`.${handleClass}`);
      if (overflowCondition && handle.classList.contains("resize-handle")) {
        handle.classList.remove("resize-handle");
        handle.classList.add("overflow-handle");
        const iconTemplate = document.createElement("div");
        iconTemplate.innerHTML = overflowIcon;
        handle.append(iconTemplate.firstElementChild);
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

  moveBySubdivisions(movedSubdivisions, newTr = null) {
    const timeOffset = this.calendar.subdivisionsToTime(movedSubdivisions);
    const previousRow = this.getRow();

    let sameRow = false;
    if (newTr !== null) {
      const newId = newTr.dataset.resource_id;
      if (this.resourceId === newId) {
        sameRow = true;
      }
      this.resourceId = newId;
    }
    const tz = Temporal.Now.timeZoneId();
    this.setStartTime(
      this.startDate.toZonedDateTime(tz).epochMilliseconds + timeOffset,
    );
    this.setEndTime(
      this.endDate.toZonedDateTime(tz).epochMilliseconds + timeOffset,
    );
    this.renderUpdate();
    if (!sameRow) {
      Event.updateRow(previousRow);
    }
    this.updateRow();
  }

  /**
   *
   * @param movedSubdivisions
   * @param startTime
   * @param endTime
   * @param resizeStart - if true, resize start date, if false, resize end date
   */
  resizeBySubdivisions(
    movedSubdivisions,
    startTime,
    endTime,
    resizeStart = true,
  ) {
    const timeOffset = this.calendar.subdivisionsToTime(movedSubdivisions);
    const tz = Temporal.Now.timeZoneId();
    if (resizeStart) {
      // resize at Start
      let newTime;
      if (this.calendar.viewmode.name === "day") {
        newTime = startTime;
      } else {
        const offsetMs =
          this.startDate.toZonedDateTime(tz).offsetNanoseconds / 1e6;
        newTime =
          Utils.findBiggestEquidistantValue(
            startTime,
            this.calendar.subdivisionInterval,
          ) - offsetMs;
      }
      newTime = newTime + timeOffset;
      if (newTime >= this.endDate.toZonedDateTime(tz).epochMilliseconds) {
        return;
      }
      this.setStartTime(newTime);
    } else {
      // resize at End
      let newTime;
      if (this.calendar.viewmode.name === "day") {
        newTime = endTime;
      } else {
        const offsetMs =
          this.endDate.toZonedDateTime(tz).offsetNanoseconds / 1e6;
        newTime =
          Utils.findBiggestEquidistantValue(
            endTime,
            this.calendar.subdivisionInterval,
          ) - offsetMs;
      }
      newTime = newTime + timeOffset;
      if (newTime <= this.startDate.toZonedDateTime(tz).epochMilliseconds) {
        return;
      }
      this.setEndTime(newTime);
    }
    this.renderUpdate();
    this.updateRow();
  }

  /**
   * safely detach the event element from dom to move it
   */
  detach() {
    if (!this.element) {
      // dom event doesnt exist
      return;
    }
    this.element.parentNode?.removeChild(this.element);
  }

  /**
   * removes event element
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

    this.element.style.left = diffXStart + "px";
    this.element.style.right = diffXEnd + "px";
    this.element.style.width = diffXEnd - diffXStart + "px";
  }

  moveToCorrectResource() {
    const tr = this.getRow();
    const td = tr.querySelector("td");

    this.element.style.top = "0px";

    td.append(this.element);
  }

  getRow() {
    return this.calendar.rows.get(this.resourceId);
  }

  updateRow() {
    Event.updateRow(this.getRow());
  }

  static updateRow(tr) {
    if (!tr) {
      return;
    }

    const td = tr.querySelector("td");
    if (!td) {
      return;
    }

    const eventElements = Array.from(td.querySelectorAll(".rc-event"));

    const allEvents = eventElements
      .map((el) => el._event)
      .filter(Boolean)
      .sort((a, b) => {
        const startCmp = Temporal.PlainDateTime.compare(
          a.startDate,
          b.startDate,
        );
        if (startCmp !== 0) return startCmp;
        return Temporal.PlainDateTime.compare(a.endDate, b.endDate);
      });

    const processedEvents = [];
    let maxHeightIndex = 0;

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
   * renders the event according to the object members
   */
  renderUpdate() {
    this.toggleOverflowHandles();
    this.detach();
    this.updatePositionAndWidth();
    this.moveToCorrectResource();
  }

  /**
   * this only gets called when the event is changed using the detail modal, not on resize/move
   */
  renderDetailUpdates() {
    this.updateTitle();
    this.updateColor();
  }

  /**
   * shift element to the heightIndex to make place for overlapping events
   */
  shiftToIndex() {
    this.heightIndex = Math.max(0, this.heightIndex);
    this.element.style.top =
      this.heightIndex * this.element.offsetHeight + "px";
  }

  setStartTime(newEpochMs) {
    this.startDate = Temporal.Instant.fromEpochMilliseconds(newEpochMs)
      .toZonedDateTimeISO(Temporal.Now.timeZoneId())
      .toPlainDateTime();
  }

  setEndTime(newEpochMs) {
    this.endDate = Temporal.Instant.fromEpochMilliseconds(newEpochMs)
      .toZonedDateTimeISO(Temporal.Now.timeZoneId())
      .toPlainDateTime();
  }

  setStartDate(newDate) {
    this.startDate = newDate;
  }

  setEndDate(newDate) {
    this.endDate = newDate;
  }

  setTitle(newTitle) {
    this.title = newTitle;
  }

  setColor(newColor) {
    this.color = newColor ?? this.calendar.options.defaultEventColor;
  }

  setAllDay(allDay) {
    this.allDay = allDay ?? false;
  }

  updateTitle() {
    this.element.setAttribute("title", this.title);
    this.element.querySelector("span").textContent = this.title;
  }

  updateColor() {
    this.element.style.backgroundColor = this.color;
    this.element.style.borderColor = Utils.shadeColor(this.color, 1.1);
    this.element.style.color = Utils.getContrastYIQ(this.color);
  }

  save() {
    this.calendar.saveEventFunction?.(this);
  }

  delete() {
    this.calendar.deleteEventFunction?.(this);
  }
}
