/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

const NAMESPACE = "Hygular";

const state = {
  enabled: false,
};

/**
 * Labels and colors for console output.
 */
const LEVELS = {
  log: { label: "LOG", color: "#3b82f6" },
  warn: { label: "WARN", color: "#f59e0b" },
  error: { label: "ERROR", color: "#ef4444" },
};

const NAMESPACE_STYLE =
  "background:#0f172a;color:#f8fafc;font-weight:600;padding:2px 8px;border-radius:4px 0 0 4px;";

const badgeStyle = (color) =>
  `background:${color};color:#0f172a;font-weight:700;padding:2px 8px;border-radius:0 4px 4px 0;`;

const format = (level) => [
  `%c ${NAMESPACE} %c ${LEVELS[level].label} `,
  NAMESPACE_STYLE,
  badgeStyle(LEVELS[level].color),
];

/**
 * Write to the console, suppressing guarded messages when debugging is disabled.
 */
function emit(method, level, guarded, args) {
  if (guarded && !state.enabled) return;
  console[method](...format(level), ...args);
}

const Debug = {
  enable() {
    state.enabled = true;
  },

  disable() {
    state.enabled = false;
  },

  /**
   * Coerce the supplied value to a boolean.
   */
  set(value) {
    state.enabled = Boolean(value);
  },

  // Expose the current debug flag.
  get isEnabled() {
    return state.enabled;
  },

  /**
   * Log a diagnostic message when debugging is enabled.
   */
  log(...args) {
    emit("log", "log", true, args);
  },

  /**
   * Log a warning when debugging is enabled.
   */
  warn(...args) {
    emit("warn", "warn", true, args);
  },

  /**
   * Log an error regardless of the debug setting.
   */
  error(...args) {
    emit("error", "error", false, args);
  },
  
  /**
   * Groups messages while debug mode is on.
   */
  group(label) {
    if (!state.enabled) return;
    console.group(...format("log"), label);
  },

  /**
   * End the current console group when debugging is enabled.
   */
  groupEnd() {
    if (state.enabled) console.groupEnd();
  },
};

export default Debug;
