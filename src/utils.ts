/**
 * General Utility functions for calendar
 * note: put this into a module in the future
 */
import { Temporal } from "temporal-polyfill";

let colorContext: CanvasRenderingContext2D | null | undefined;
const colorCache = new Map<string, [number, number, number, number] | null>();

export const Utils = {
  /**
   * Calculates the absolute time difference between two dates in milliseconds.
   */
  calculateIntervalMilliseconds(
    date1: Temporal.PlainDateTime,
    date2: Temporal.PlainDateTime,
  ): number {
    return Math.abs(
      date1.since(date2).total({ unit: "milliseconds", relativeTo: date1 }),
    );
  },

  /**
   * Calculates the ISO week number for a given date.
   */
  getWeekNumber(d: Temporal.PlainDate): number {
    const thursday = d.add({ days: 4 - (d.dayOfWeek === 7 ? 7 : d.dayOfWeek) });
    const yearStart = Temporal.PlainDate.from({
      year: thursday.year,
      month: 1,
      day: 1,
    });
    return Math.ceil(
      (thursday
        .since(yearStart)
        .total({ unit: "days", relativeTo: yearStart }) +
        1) /
        7,
    );
  },

  /**
   * Resolves any CSS color the browser's canvas understands (hex, names,
   * `rgb()`, `hsl()`, `oklch()`, ...) to sRGB bytes plus alpha in `[0, 1]`.
   * Returns `null` for anything unparseable, including `var()` references,
   * which only a styled element can resolve.
   */
  parseColor(color: string): [number, number, number, number] | null {
    const cached = colorCache.get(color);
    if (cached !== undefined) {
      return cached;
    }

    if (colorContext === undefined) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      colorContext = canvas.getContext("2d", { willReadFrequently: true });
    }

    let result: [number, number, number, number] | null = null;
    const ctx = colorContext;
    if (ctx) {
      ctx.fillStyle = "#000";
      ctx.fillStyle = color;
      const onBlack = ctx.fillStyle;
      ctx.fillStyle = "#fff";
      ctx.fillStyle = color;
      if (onBlack === ctx.fillStyle) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        result = [r, g, b, a / 255];
      }
    }

    colorCache.set(color, result);
    return result;
  },

  /**
   * Picks a readable (black or white) text color for a background color, or
   * `null` when the color cannot be parsed. Translucent colors are judged as
   * laid over white.
   */
  getContrastColor(color: string): "black" | "white" | null {
    const parsed = this.parseColor(color);
    if (!parsed) {
      return null;
    }
    const [r, g, b] = parsed
      .slice(0, 3)
      .map((channel) => channel * parsed[3] + 255 * (1 - parsed[3]));
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "black" : "white";
  },

  /**
   * Largest multiple of interval that is less than or equal to target.
   */
  floorToMultiple(target: number, interval: number): number {
    if (interval === 0) {
      return 0;
    }

    return Math.floor(target / interval) * interval;
  },

  /**
   * Smallest multiple of interval that is greater than or equal to target.
   */
  ceilToMultiple(target: number, interval: number): number {
    if (interval === 0) {
      return 0;
    }

    return Math.ceil(target / interval) * interval;
  },

  /**
   * Parses an `"HH:MM"` time of day into minutes after midnight. Accepts
   * `"24:00"` as the end of the day; returns `null` for anything else invalid.
   */
  parseTimeOfDay(time: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time?.trim() ?? "");
    if (!match) {
      return null;
    }
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    if (Number(match[2]) > 59 || minutes > 24 * 60) {
      return null;
    }
    return minutes;
  },

  /**
   * Converts a date to the `YYYY-MM-DD` string expected by `<input type="date">`.
   */
  formatDateForInput(date: Temporal.PlainDateTime): string {
    return date.toPlainDate().toString();
  },
};
