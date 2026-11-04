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

The UMD build has the date polyfill inlined, so a `<script>` tag needs nothing
else:

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

Behaviour options:

- `editable: false` makes the calendar read-only: no creating, dragging or resizing events. `eventClick` still fires.
- `selectable: false` stops clicks on empty cells from calling `dateClick`, so users can't create events.
- `minTime` / `maxTime` (`"HH:MM"`, default `"00:00"` / `"24:00"`) limit the hours shown in day view. They have no effect in week or month view.

See `ResourceCalendar.DEFAULT_OPTIONS` in `src/ResourceCalendar.ts` for the full option list and defaults.

## Theming

Set `theming` to use your CSS framework's palette:

```js
new ResourceCalendar({
  containerId: "calendar",
  theming: "bootstrap5", // "none" (default) | "bootstrap5" | "tailwind4"
});
```

The calendar then reads the framework's CSS variables, so it also follows the framework's dark mode. If the framework isn't loaded, the calendar keeps its default look. Tailwind v3 has no runtime theme variables, so use custom variables (below) instead.

A theme clears `defaultEventColor` so the theme's event colours apply. Pass `defaultEventColor` explicitly to override that. A `backgroundColor` on an individual event always takes precedence.

### Custom themes

Every colour and radius is a `--rc-*` custom property. Redeclare them on `.rc-calendar`:

```css
.rc-calendar {
  --rc-event-bg: #dbeafe;
  --rc-today-bg: #fca5a5;
}
```

The defaults are in `@layer calendar.base`, so your unlayered rules win without extra specificity. This works together with `theming`. To have the variables colour events without a theme, set `defaultEventColor: ""`.

<details>
<summary>The full set of variables</summary>

| Variable                        | Default                    | What it colours                              |
| ------------------------------- | -------------------------- | -------------------------------------------- |
| `--rc-border-color`             | `rgba(0, 0, 0, 0.3)`       | grid lines                                   |
| `--rc-stripe-bg`                | `rgba(0, 0, 0, 0.05)`      | row / column striping                        |
| `--rc-event-bg`                 | `#d1e7dd`                  | event background                             |
| `--rc-event-border-color`       | `#a3cfbb`                  | event border                                 |
| `--rc-event-color`              | `#664d03`                  | event text                                   |
| `--rc-drop-bg`                  | `#eaf6f0`                  | cells an event would land on, while dragging |
| `--rc-today-bg`                 | `#ffc107`                  | today's column header                        |
| `--rc-today-subtle-bg`          | `#fff3cd`                  | today's column body                          |
| `--rc-btn-color`                | `#fff`                     | toolbar button text                          |
| `--rc-btn-bg`                   | `#212529`                  | toolbar button background                    |
| `--rc-btn-border-color`         | `#212529`                  | toolbar button border                        |
| `--rc-btn-hover-bg`             | `#424649`                  | toolbar button, hovered                      |
| `--rc-btn-hover-border-color`   | `#373b3e`                  | toolbar button border, hovered               |
| `--rc-btn-active-bg`            | `#4d5154`                  | toolbar button, pressed or active            |
| `--rc-btn-active-border-color`  | `#373b3e`                  | toolbar button border, pressed or active     |
| `--rc-input-color`              | `#212529`                  | date picker text                             |
| `--rc-input-bg`                 | `#fff`                     | date picker background                       |
| `--rc-input-border-color`       | `#ced4da`                  | date picker border                           |
| `--rc-input-focus-border-color` | `#86b7fe`                  | date picker border, focused                  |
| `--rc-focus-ring`               | `rgba(13, 110, 253, 0.25)` | date picker focus ring                       |
| `--rc-border-radius`            | `0.375rem`                 | buttons and the date picker                  |

</details>

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
