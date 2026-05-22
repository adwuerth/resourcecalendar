// Declaration merging for the non-standard expando properties this library
// stashes directly on DOM nodes.
import type { ResourceCalendar } from "./ResourceCalendar.js";
import type { Event as CalendarEvent } from "./Event.js";

declare global {
  interface Element {
    /** Back-reference to the Event wrapper, set by Event#initiate. */
    _event?: CalendarEvent;
  }

  interface HTMLElement {
    /** Back-reference set on the calendar's container element. */
    _calendar?: ResourceCalendar;
    /** Persistent event id mirrored onto the event element. */
    _eventId?: string | number | null;
    /** Drop target captured during a drag, consumed on dragend. */
    _dropTarget?: HTMLElement | null;
  }

  interface HTMLTableRowElement {
    /** Cached max stacking index, used to skip redundant row reflows. */
    _heightIndex?: number;
  }
}

export {};
