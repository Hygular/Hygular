/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

const locks = new WeakMap();
const COMPENSATED_SELECTOR =
  "[data-fixed-lock], [data-sticky-lock]";
const SCROLLBAR_WIDTH_PROPERTY = "--hygular-scrollbar-width";

/** Save only properties owned by the lock, including their priorities. */
function setStyle(state, element, property, value) {
  let properties = state.styles.get(element);
  if (!properties) {
    properties = new Map();
    state.styles.set(element, properties);
  }
  if (!properties.has(property)) {
    properties.set(property, {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    });
  }
  element.style.setProperty(property, value, "important");
}

function restoreStyles(state) {
  for (const [element, properties] of state.styles) {
    for (const [property, saved] of properties) {
      if (saved.value) {
        element.style.setProperty(property, saved.value, saved.priority);
      } else {
        element.style.removeProperty(property);
      }
    }
  }
  state.styles.clear();
}

function measureScrollbar(document) {
  const view = document?.defaultView;
  return view && document.documentElement
    ? Math.max(0, view.innerWidth - document.documentElement.clientWidth)
    : 0;
}

function applyLock(document, state) {
  const view = document.defaultView;
  const root = document.documentElement;
  const body = document.body;
  const rootStyle = view.getComputedStyle(root);
  const capture = (element) => {
    const style = view.getComputedStyle(element);
    return {
      element,
      rect: element.getBoundingClientRect(),
      left: parseFloat(style.paddingLeft) || 0,
      right: parseFloat(style.paddingRight) || 0,
    };
  };
  const bodyBefore = capture(body);
  const marked = [...document.querySelectorAll(COMPENSATED_SELECTOR)]
    .filter((element) => element !== body && element !== root)
    .map(capture);

  setStyle(state, root, SCROLLBAR_WIDTH_PROPERTY, `${state.width}px`);
  setStyle(state, root, "overflow-anchor", "none");
  setStyle(state, body, "overflow-anchor", "none");

  // Keep the existing viewport gutter instead of adding a second padding gap.
  if (
    state.width > 0 &&
    view.CSS?.supports("scrollbar-gutter", "stable") &&
    !rootStyle.scrollbarGutter.includes("stable")
  ) {
    setStyle(state, root, "scrollbar-gutter", "stable");
  }

  for (const element of [root, body]) {
    setStyle(state, element, "overflow-x", "hidden");
    setStyle(state, element, "overflow-y", "hidden");
  }

  // Compensate the edge that actually expanded, including RTL fixed elements.
  // Process ancestors first so nested markers do not receive the same gap twice.
  for (const entry of [bodyBefore, ...marked]) {
    const rect = entry.element.getBoundingClientRect();
    const left = Math.max(0, entry.rect.left - rect.left);
    const right = Math.max(0, rect.right - entry.rect.right);
    if (left > 0) {
      setStyle(state, entry.element, "padding-left", `${entry.left + left}px`);
    }
    if (right > 0) {
      setStyle(
        state,
        entry.element,
        "padding-right",
        `${entry.right + right}px`,
      );
    }
  }
}

/** One owner of a document-wide scroll lock. Use one instance per overlay. */
export default class ScrollLock {
  #document;
  #lockedDocument = null;

  constructor(ownerDocument) {
    this.#document = ownerDocument;
  }

  get isLocked() {
    return this.#lockedDocument !== null;
  }

  /** Return the scrollbar width captured by an active lock, or measure it. */
  getScrollbarWidth() {
    const ownerDocument = this.#lockedDocument || this.#getDocument();
    return locks.get(ownerDocument)?.width ?? measureScrollbar(ownerDocument);
  }

  /** Acquire this instance's lock. Repeated calls have no additional effect. */
  lock() {
    if (this.#lockedDocument) return this;
    const ownerDocument = this.#getDocument();
    if (!ownerDocument?.body || !ownerDocument.defaultView) return this;

    let state = locks.get(ownerDocument);
    if (!state) {
      state = {
        owners: new Set(),
        styles: new Map(),
        width: measureScrollbar(ownerDocument),
      };
      try {
        applyLock(ownerDocument, state);
      } catch (error) {
        restoreStyles(state);
        throw error;
      }
      locks.set(ownerDocument, state);
    }
    state.owners.add(this);
    this.#lockedDocument = ownerDocument;
    return this;
  }

  /** Release only this owner's lock; the final owner restores saved styles. */
  unlock() {
    const ownerDocument = this.#lockedDocument;
    if (!ownerDocument) return this;
    this.#lockedDocument = null;

    const state = locks.get(ownerDocument);
    if (!state) return this;
    state.owners.delete(this);
    if (state.owners.size === 0) {
      restoreStyles(state);
      locks.delete(ownerDocument);
    }
    return this;
  }

  #getDocument() {
    return (
      this.#document ?? (typeof document === "undefined" ? null : document)
    );
  }
}
