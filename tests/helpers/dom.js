import { JSDOM } from "jsdom";

/** Install a fresh DOM with explicit observer and animation-frame controls. */
export function createDOM(markup = "") {
  const dom = new JSDOM(`<!doctype html><html><body>${markup}</body></html>`, {
    url: "https://hygular.test/",
    pretendToBeVisual: true,
  });
  const saved = new Map();
  const install = (key, value) => {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  };
  const { window } = dom;
  for (const key of [
    "window",
    "document",
    "Element",
    "HTMLElement",
    "Node",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "KeyboardEvent",
    "MutationObserver",
    "Image",
    "FormData",
    "localStorage",
    "navigator",
  ]) {
    install(key, key === "window" ? window : window[key]);
  }
  install("getComputedStyle", window.getComputedStyle.bind(window));
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  const frames = new Map();
  let frameId = 0;
  install("requestAnimationFrame", (fn) => {
    frames.set(++frameId, fn);
    return frameId;
  });
  install("cancelAnimationFrame", (id) => frames.delete(id));
  const observers = [];
  class Observer {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
      observers.push(this);
    }
    observe(el) {
      this.targets.add(el);
    }
    unobserve(el) {
      this.targets.delete(el);
    }
    disconnect() {
      this.targets.clear();
      this.disconnected = true;
    }
  }
  install("IntersectionObserver", Observer);
  install("ResizeObserver", Observer);
  const errors = [];
  window.addEventListener("error", (event) => {
    errors.push(event.error);
    event.preventDefault();
  });
  return {
    window,
    observers,
    errors,
    flushFrames() {
      for (let pass = 0; frames.size && pass < 10; pass++) {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((fn) => fn(0));
      }
    },
    close() {
      window.close();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const key = (element, value) =>
  element.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: value,
      bubbles: true,
      cancelable: true,
    }),
  );
export function endTransition(element, propertyName = "opacity") {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  element.dispatchEvent(event);
}
