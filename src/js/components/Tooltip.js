/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DomUtils from "../utils/DomUtils.js";
import Debug from "../core/Debug.js";

export default class Tooltip {
  static #instances = new WeakMap();
  #el = null;
  #tooltip = null;
  #config = null;
  #shown = false;
  #isDisposed = false;
  #showHandler = null;
  #hideHandler = null;
  #escapeHandler = null;
  #updateHandler = null;
  #description = null;
  #position = null;

  // Default options
  #defaults = {
    message: "Hi, I am a tooltip message",
    placement: "auto",
    hasArrow: true,
    autoClean: false,
  };

  // CSS class names
  #class = {
    tooltip: "tooltip",
    active: "is-open",
    arrow: "has-arrow",
    top: "is-top",
    bottom: "is-bottom",
    left: "is-left",
    right: "is-right",
  };

  /**
   * Bind a tooltip to the target, disposing any instance already attached to it.
   */
  constructor(selector, options = {}) {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    this.#el =
      typeof selector === "string"
        ? document.querySelector(selector)
        : selector;

    if (!(this.#el instanceof Element)) {
      Debug.warn("[Tooltip] Target element is not a valid DOM element.");
      return;
    }

    const existing = Tooltip.#instances.get(this.#el);
    if (existing) existing.dispose();

    this.#config = this.#readConfig(options);
    Tooltip.#instances.set(this.#el, this);

    this.#bindEvents();
  }

  /**
   * Merge defaults, data attributes, and explicit options in that order.
   */
  #readConfig(options = {}) {
    const attrConfig = {
      message: this.#el.dataset.tooltip,
      placement: this.#el.dataset.placement,
    };

    return {
      ...this.#defaults,
      ...this.#omitEmptyOptions(attrConfig),
      ...this.#omitEmptyOptions(options),
    };
  }

  /**
   * Discard undefined, null, and empty-string option values.
   */
  #omitEmptyOptions(obj) {
    return Object.fromEntries(
      Object.entries(obj).filter(([, value]) => {
        return value !== undefined && value !== null && value !== "";
      }),
    );
  }

  /**
   * Bind touch or mouse interactions, keyboard focus, and Escape dismissal.
   */
  #bindEvents() {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    this.#escapeHandler = (event) => {
      if (event.key === "Escape") this.hide();
    };

    this.#showHandler = () => this.show();
    this.#hideHandler = () => this.hide();

    if (isTouch) {
      this.#el.addEventListener("touchstart", this.#showHandler, {
        passive: true,
      });
      this.#el.addEventListener("touchend", this.#hideHandler);
      this.#el.addEventListener("touchcancel", this.#hideHandler);
    } else {
      this.#el.addEventListener("mouseenter", this.#showHandler);
      this.#el.addEventListener("mouseleave", this.#hideHandler);
    }

    this.#el.addEventListener("focus", this.#showHandler);
    this.#el.addEventListener("blur", this.#hideHandler);
    document.addEventListener("keydown", this.#escapeHandler);
  }

  /**
   * Create the tooltip from plain text and schedule its placement and entry state.
   */
  show() {
    if (this.#isDisposed || this.#shown || !this.#el) return;

    const message = String(this.#config.message ?? "").trim();
    if (!message) return;

    const id = this.#uniqueId();

    this.#tooltip = document.createElement("div");
    this.#tooltip.id = id;
    this.#tooltip.className = this.#class.tooltip;
    this.#tooltip.setAttribute("role", "tooltip");
    this.#tooltip.textContent = message;

    if (this.#config.hasArrow) {
      this.#tooltip.classList.add(this.#class.arrow);
    }

    this.#description = this.#el.getAttribute("aria-describedby");
    this.#el.setAttribute(
      "aria-describedby",
      [this.#description, id].filter(Boolean).join(" "),
    );

    if (getComputedStyle(this.#el).position === "static") {
      this.#position = {
        value: this.#el.style.getPropertyValue("position"),
        priority: this.#el.style.getPropertyPriority("position"),
      };
      this.#el.style.position = "relative";
    }

    this.#el.appendChild(this.#tooltip);

    const tooltip = this.#tooltip;
    DomUtils.afterPaint(() => {
      if (this.#tooltip !== tooltip || this.#isDisposed) return;

      this.#applyPlacement();
      this.#tooltip.classList.add(this.#class.active);
    });

    this.#shown = true;

    this.#startAutoUpdate();
  }

  /**
   * Replace the current placement classes with the resolved side.
   */
  #applyPlacement() {
    if (!this.#tooltip || !this.#el) return;

    this.#clearPlacement();

    const placement = this.#resolvePlacement();
    this.#tooltip.classList.add(this.#class[placement]);
  }

  /**
   * Use the preferred side when it fits; otherwise choose the best available side.
   */
  #resolvePlacement() {
    const preferred = this.#normalizePlacement(this.#config.placement);
    const rect = this.#el.getBoundingClientRect();
    const tooltipRect = this.#tooltip.getBoundingClientRect();

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const space = {
      top: rect.top,
      bottom: winH - rect.bottom,
      left: rect.left,
      right: winW - rect.right,
    };

    const fits = {
      top: space.top >= tooltipRect.height,
      bottom: space.bottom >= tooltipRect.height,
      left: space.left >= tooltipRect.width,
      right: space.right >= tooltipRect.width,
    };

    if (preferred !== "auto" && fits[preferred]) {
      return preferred;
    }

    const fittingPlacements = Object.keys(fits).filter((key) => fits[key]);

    if (fittingPlacements.length) {
      return this.#bestPlacement(fittingPlacements, space, tooltipRect);
    }

    return this.#bestPlacement(
      ["top", "bottom", "left", "right"],
      space,
      tooltipRect,
    );
  }

  /**
   * Rank sides by available space relative to the tooltip dimensions.
   */
  #bestPlacement(placements, space, tooltipRect) {
    const scores = {
      top: space.top / tooltipRect.height,
      bottom: space.bottom / tooltipRect.height,
      left: space.left / tooltipRect.width,
      right: space.right / tooltipRect.width,
    };

    return placements.sort((a, b) => scores[b] - scores[a])[0];
  }

  /**
   * Fall back to auto for unsupported placement values.
   */
  #normalizePlacement(value) {
    return ["auto", "top", "bottom", "left", "right"].includes(value)
      ? value
      : "auto";
  }

  /**
   * Remove the previous placement classes.
   */
  #clearPlacement() {
    this.#tooltip.classList.remove(
      this.#class.top,
      this.#class.bottom,
      this.#class.left,
      this.#class.right,
    );
  }

  /**
   * Update placement on resize and scroll, including scrolls in nested containers.
   */
  #startAutoUpdate() {
    if (this.#updateHandler) return;

    this.#updateHandler = () => {
      if (!this.#shown) return;
      this.#applyPlacement();
    };

    window.addEventListener("resize", this.#updateHandler);
    window.addEventListener("scroll", this.#updateHandler, true);
  }

  /**
   * Detach the resize and scroll listeners.
   */
  #stopAutoUpdate() {
    if (!this.#updateHandler) return;

    window.removeEventListener("resize", this.#updateHandler);
    window.removeEventListener("scroll", this.#updateHandler, true);

    this.#updateHandler = null;
  }

  /**
   * Hide the tooltip and clear its description link. Dispose the instance if
   * autoClean is enabled.
   */
  hide() {
    if (!this.#shown || this.#isDisposed) return;

    this.#stopAutoUpdate();

    this.#tooltip?.remove();
    this.#tooltip = null;
    this.#shown = false;

    if (this.#description === null)
      this.#el?.removeAttribute("aria-describedby");
    else this.#el?.setAttribute("aria-describedby", this.#description);
    if (this.#position) {
      if (this.#position.value)
        this.#el.style.setProperty(
          "position",
          this.#position.value,
          this.#position.priority,
        );
      else this.#el.style.removeProperty("position");
      this.#position = null;
    }

    if (this.#config.autoClean) this.dispose();
  }

  /**
   * Generate an ID for the tooltip's ARIA reference.
   */
  #uniqueId() {
    return `hygular-tooltip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Return the instance attached to an element, if any.
   */
  static getInstance(element) {
    return Tooltip.#instances.get(element);
  }

  /**
   * Initialize matching elements, reusing existing instances.
   */
  static init(selector = '[data-hygular="tooltip"]') {
    if (typeof document === "undefined") return [];

    return [...document.querySelectorAll(selector)].map((el) => {
      return Tooltip.#instances.get(el) || new Tooltip(el);
    });
  }

  /**
   * Hide the tooltip, detach handlers, and clear the instance registration and
   * references.
   */
  dispose() {
    if (this.#isDisposed) return;
    this.hide();
    this.#el?.removeEventListener("mouseenter", this.#showHandler);
    this.#el?.removeEventListener("mouseleave", this.#hideHandler);
    this.#el?.removeEventListener("touchstart", this.#showHandler);
    this.#el?.removeEventListener("touchend", this.#hideHandler);
    this.#el?.removeEventListener("touchcancel", this.#hideHandler);
    this.#el?.removeEventListener("focus", this.#showHandler);
    this.#el?.removeEventListener("blur", this.#hideHandler);
    this.#el?.ownerDocument.removeEventListener("keydown", this.#escapeHandler);
    Tooltip.#instances.delete(this.#el);
    this.#isDisposed = true;
    this.#el = null;
    this.#tooltip = null;
    this.#config = null;
  }
}
