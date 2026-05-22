/**
 * @typedef {symbol} StripingMode
 */

export const Striping = Object.freeze({
  /** @type {StripingMode} */
  NONE: Symbol("none"),
  /** @type {StripingMode} */
  COLUMNS: Symbol("columns"),
  /** @type {StripingMode} */
  ROWS: Symbol("rows"),

  /**
   * Resolves a striping mode from its string description, falling back to
   * {@link Striping.DEFAULT} for unknown values.
   * @param {string} str
   * @returns {StripingMode}
   */
  from(str) {
    return /** @type {StripingMode} */ (
      Object.values(this).find(
        (symbol) => typeof symbol === "symbol" && symbol.description === str,
      ) ?? this.DEFAULT
    );
  },

  /**
   * @returns {StripingMode}
   */
  get DEFAULT() {
    return this.NONE;
  },
});
