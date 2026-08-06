# resourcecalendar

A resource calendar for the browser. Rows are resources (people, rooms, machines), columns are time, and events are draggable blocks placed on the grid. The only runtime dependency is [temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill), which handles all date math.

The library provides day, week, and month views, drag-and-drop and resize, overlap stacking, and a configurable toolbar. It does not talk to a server on its own. You supply callbacks, and the calendar invokes them when it needs data or when an event changes.

## Background

This component was developed as part of the [Limbas](https://github.com/limbas/limbas) project, a low-code database and application framework. This repository is the standalone version, extracted by the author so it can be used independently of Limbas.

## Install

This package is not published to npm yet. Install it directly from the repository:

```bash
npm install github:adwuerth/resourcecalendar
```

Or clone it and build the bundle yourself (see [Development](#development)).

## Usage

```js
import { ResourceCalendar } from "resourcecalendar";
import "resourcecalendar/style.css";

const calendar = new ResourceCalendar({
  containerId: "calendar",
  fetchResourcesFunction: () => ({
    1: "Room A",
    2: "Room B",
  }),
  fetchEventDataFunction: () => [
    {
      id: 1,
      resourceId: 1,
      title: "Standup",
      start: "2026-07-08T09:00",
      end: "2026-07-08T09:30",
    },
  ],
});

calendar.render();
```

### Without a bundler

The UMD build is self-contained — it has the date polyfill inlined, so a
`<script>` tag needs nothing else:

```html
<link
  rel="stylesheet"
  href="node_modules/resourcecalendar/dist/resourcecalendar.css"
/>
<script src="node_modules/resourcecalendar/dist/resourcecalendar.umd.cjs"></script>
<script>
  const calendar = new ResourceCalendar.ResourceCalendar({
    containerId: "calendar",
  });
  calendar.render();
</script>
```

The ES build keeps `temporal-polyfill` external instead, so your bundler
resolves the single installed copy rather than shipping a second one.

The data callbacks are yours to implement:

- `fetchResourcesFunction` returns `{ resourceId: label }` for the rows.
- `fetchEventDataFunction` returns the events as JSON.
- `saveEventFunction` / `deleteEventFunction` run when the user drags, resizes, or deletes an event, so you can persist the change.
- `dateClick` / `eventClick` / `eventDrop` are interaction hooks.

See `ResourceCalendar.DEFAULT_OPTIONS` in `src/ResourceCalendar.ts` for the full option list and defaults.

## Development

```bash
npm run dev        # Vite dev server; open examples/index.html for a live calendar
npm run build      # ES + UMD bundles and .d.ts files into dist/
npm run typecheck  # type-check without emitting
npm run preview    # serve the built bundle
```

The source is TypeScript. Vite transpiles it for the bundles; `tsc` only emits
the `.d.ts` files.

## License

GPL-2.0-only
