export const Striping = Object.freeze({
  NONE: Symbol("none"),
  COLUMNS: Symbol("columns"),
  ROWS: Symbol("rows"),

  from(str) {
    return (
      Object.values(this).find(
        (symbol) => typeof symbol === "symbol" && symbol.description === str,
      ) ?? this.DEFAULT
    );
  },

  get DEFAULT() {
    return this.NONE;
  },
});
