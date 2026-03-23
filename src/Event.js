import $ from "jquery";
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
    const $startTd = $(startTd).closest("tr").find("td").first();
    const clickX = e.originalEvent.clientX;
    const tdOffset = $startTd.offset().left;
    const diffX = clickX - tdOffset;
    const snappedWidth = Utils.findSmallestEquidistantValue(
      diffX,
      calendar.tdWidth,
    );

    const startDate = calendar.getDateFromDiffX(snappedWidth);
    const endDate = calendar.getNextDate(startDate);
    const resourceId = $startTd.closest("tr").data("resource_id");
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
    if (this.$event) {
      this.remove();
    }

    const $event = $(`
            <div
                id="event-${this.eventId}"
                draggable="true"
                class="rc-event d-flex justify-content-center align-items-center">
                ${this.additionalEventHTML}
                <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"></span>
                <div class="resize-handle handle-start d-flex justify-content-center align-items-center"></div>
                <div class="resize-handle handle-end d-flex justify-content-center align-items-center"></div>
            </div>
        `);

    $event.data("event_id", this.eventId);
    $event.data("event", this);

    const event = this;

    let isResizing;
    let startX;
    let startTime;
    let endTime;

    const $resizeHandleStart = $event.find(".handle-start");
    const $resizeHandleEnd = $event.find(".handle-end");

    $resizeHandleStart.on("mousedown", (e) =>
      handleMouseDown(e, true, $resizeHandleStart),
    );
    $resizeHandleEnd.on("mousedown", (e) =>
      handleMouseDown(e, false, $resizeHandleEnd),
    );

    $event.on("click", (e) => {
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

    $event.on("dragstart", (e) => {
      dragStartX = e.clientX;

      $event.data("drop_target", null);

      e.originalEvent.dataTransfer.setData("text/plain", e.currentTarget.id);

      // timeout used for chromium fix
      setTimeout(() => {
        $(e.currentTarget).css("opacity", "0.5");
        $(e.currentTarget).css("cursor", "grabbing");
        this.calendar.$dropzones.css("z-index", 1000);
      }, 0);
    });

    $event.on("dragend", (e) => {
      $(e.currentTarget).css({
        opacity: "1",
        cursor: "grab",
      });
      this.calendar.$dropzones.removeClass("drag-over");

      const dropTarget = $event.data("drop_target");

      if (dropTarget !== null) {
        const $dropTarget = $(dropTarget);
        let endX = e.clientX;
        const draggedDistanceX = endX - dragStartX;
        const $newTr = $dropTarget.closest("tr");
        let movedSubdivisions = Math.round(
          draggedDistanceX / this.calendar.tdWidth,
        );
        this.moveBySubdivisions(movedSubdivisions, $newTr);
        event.save();
      } else {
        // note: potential functionality: maybe drop it as far as possible
      }

      event.calendar.$dropzones.css("z-index", -1);
      $event.removeData("drop_target");
    });

    function handleMouseDown(e, resizeStart, $handle) {
      if ($handle.hasClass("overflow-handle")) {
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
      $event.addClass("resizing");

      e.preventDefault();
      e.stopPropagation();

      $("body").css("cursor", "ew-resize");

      $(document).on("mousemove.resizing", (event) =>
        handleMouseMove(event, resizeStart),
      );
      $(document).on("mouseup.resizing", (event) => handleMouseUp(event));
    }

    function handleMouseMove(e, resizeStart) {
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

    function handleMouseUp(e) {
      e.preventDefault();
      e.stopPropagation();
      if (isResizing) {
        $event.removeClass("resizing");
        $("body").css("cursor", "default");

        $(document).off(".resizing");

        event.save();
      }
    }

    this.$event = $event;
  }

  /**
   * render the event in the dom. if render() was already called, just update dom attributes
   * This does not update the rendering in the row, call event.updateRow() after
   */
  renderPartial() {
    if (!this.$event) {
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
      const $handle = this.$event.find(`.${handleClass}`);
      if (overflowCondition && $handle.hasClass("resize-handle")) {
        $handle.removeClass("resize-handle").addClass("overflow-handle");
        $handle.append($(overflowIcon));
      } else if (!overflowCondition && $handle.hasClass("overflow-handle")) {
        $handle.removeClass("overflow-handle").addClass("resize-handle");
        $handle.find("i").remove();
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

  moveBySubdivisions(movedSubdivisions, $newTr = null) {
    const timeOffset = this.calendar.subdivisionsToTime(movedSubdivisions);
    const $previousRow = this.getRow();

    let sameRow = false;
    if ($newTr !== null) {
      const newId = $newTr.data("resource_id");
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
      Event.updateRow($previousRow);
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
    if (!this.$event) {
      // dom event doesnt exist
      return;
    }
    this.$event.detach();
  }

  /**
   * removes event element and its jquery data
   */
  remove() {
    if (!this.$event) {
      // dom event doesnt exist
      return;
    }

    let $prevTr = this.$event.closest("tr");

    this.$event.remove();

    Event.updateRow($prevTr);
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

    this.$event.css({
      left: diffXStart,
      right: diffXEnd,
    });

    this.$event.width(diffXEnd - diffXStart);
  }

  moveToCorrectResource() {
    const $tr = this.getRow();
    const $td = $tr.find("td").first();

    this.$event.css({
      top: 0,
    });

    $td.append(this.$event);
  }

  getRow() {
    return this.calendar.rows.get(this.resourceId);
  }

  updateRow() {
    Event.updateRow(this.getRow());
  }

  static updateRow($tr) {
    if (!$tr) {
      return;
    }

    const $td = $tr.find("td").first();

    const $events = $td.find(".rc-event");

    const allEvents = $events
      .map((index, element) => {
        return $(element).data("event");
      })
      .get()
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
    const trIndex = $tr.data("height_index");
    if ($events.length > 0) {
      if (trIndex !== maxHeightIndex) {
        const singleEventHeight = $events.first().height();
        $tr.height((maxHeightIndex + 2) * singleEventHeight);
        $tr.data("height_index", maxHeightIndex);
      }
    } else {
      if (trIndex > 0) {
        $tr.height(0);
        $tr.data("height_index", 0);
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
    this.$event.css("top", this.heightIndex * this.$event.outerHeight());
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
    this.$event.attr("title", this.title);
    this.$event.find("span").text(this.title);
  }

  updateColor() {
    this.$event.css("background-color", this.color);
    this.$event.css("border-color", Utils.shadeColor(this.color, 1.1));
    this.$event.css("color", Utils.getContrastYIQ(this.color));
  }

  save() {
    this.calendar.saveEventFunction?.(this);
  }

  delete() {
    this.calendar.deleteEventFunction?.(this);
  }
}
