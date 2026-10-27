/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

export const DEFAULT_BREAKPOINTS = {
  sm: "640px",
  md: "864px",
  lg: "1120px",
  xl: "1408px",
  "2xl": "1792px",
};

/** Replace breakpoint placeholders in media queries. */
export function applyBreakpoints(root, breakpoints) {
  const pattern = /var\(--breakpoint-(sm|md|lg|xl|2xl)\)/g;

  root.walkAtRules("media", (rule) => {
    rule.params = rule.params.replace(
      pattern,
      (match, alias) => breakpoints[alias] || match,
    );
  });
}
