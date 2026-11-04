// Declaration merging for the non-standard expando properties this library
// stashes directly on DOM nodes.
import type { ResourceCalendar } from "./ResourceCalendar";
import type { Event as CalendarEvent } from "./Event";

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
  }

  interface HTMLTableRowElement {
    /** Cached max stacking index, used to skip redundant row reflows. */
    _heightIndex?: number;
  }
}

export {};
