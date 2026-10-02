/** CSS tokens resolve at render time, including in SVG charts. */
export const colors = {
  primary: Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [
      n,
      `var(--color-teal-${n})`,
    ]),
  ),
  gray: Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [
      n,
      `var(--color-gray-${n})`,
    ]),
  ),
  border: {
    light: "var(--border)",
    medium: "var(--color-gray-300)",
    dark: "var(--color-gray-400)",
  },
  error: "var(--destructive)",
};
