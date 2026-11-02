/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DomUtils from "../utils/DomUtils.js";
import Debug from "../core/Debug.js";

export default class Popover {
  static #instances = new WeakMap();

  #el = null;
  #popover = null;
  #config = null;
  #shown = false;
  #isDisposed = false;
  #hiding = false;
  #originalAria = null;
  #id = null;
  #toggleHandler = null;
  #escapeHandler = null;
  #outsideHandler = null;
  #updateHandler = null;

  // Default options
  #defaults = {
    title: "",
    content: "",
    target: null,
    placement: "auto",
    trigger: "click", // click | manual
    hasArrow: true,
    closeOnOutsideClick: true,
    closeOnEscape: true,
    offset: 10,
    autoClean: false,
  };

  // CSS class names
  #class = {
    popover: "popover",
    active: "is-open",
    arrow: "has-arrow",
    header: "popover-header",
    body: "popover-body",

    top: "is-top",
    bottom: "is-bottom",
    left: "is-left",
    right: "is-right",

    start: "is-start",
    end: "is-end",
  };

  /**
   * Bind a popover to the target, disposing any instance already attached to it.
   */
  constructor(selector, options = {}) {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    this.#el =
      typeof selector === "string"
        ? document.querySelector(selector)
        : selector;

    if (!(this.#el instanceof Element)) {
      Debug.warn(
        `[Popover] Target element was not found or is not a valid DOM element.`,
      );
      return;
    }

    const existing = Popover.#instances.get(this.#el);
    if (existing) existing.dispose();

    this.#originalAria = new Map(
      ["aria-expanded", "aria-controls"].map((name) => [
        name,
        this.#el.getAttribute(name),
      ]),
    );
    this.#config = this.#readConfig(options);
    this.#id = this.#uniqueId();

    Popover.#instances.set(this.#el, this);

    this.#bindEvents();
  }

  /**
   * Merge defaults, data attributes, and explicit options in that order.
   */
  #readConfig(options = {}) {
    const attrConfig = {
      title: this.#el.dataset.title,
      content: this.#el.dataset.content || this.#el.dataset.popover,
      target: this.#el.dataset.target || this.#el.dataset.popoverTarget,
      placement: this.#el.dataset.placement,
      trigger: this.#el.dataset.trigger,
      hasArrow: this.#toBoolean(this.#el.dataset.arrow),
      closeOnOutsideClick: this.#toBoolean(this.#el.dataset.closeOutside),
      closeOnEscape: this.#toBoolean(this.#el.dataset.closeEscape),
      offset: this.#toNumber(this.#el.dataset.offset),
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
   * Return undefined for an absent value; only true and "true" enable the option.
   */
  #toBoolean(value) {
    if (value === undefined || value === null || value === "") return undefined;
    return value === "true" || value === true;
  }

  /**
   * Parse a finite number, returning undefined for absent or invalid values.
   */
  #toNumber(value) {
    if (value === undefined || value === null || value === "") return undefined;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  /**
   * Bind the trigger and Escape handler, and prepare the outside-click handler.
   */
  #bindEvents() {
    const trigger = this.#normalizeTrigger(this.#config.trigger);

    this.#escapeHandler = (event) => {
      if (this.#config.closeOnEscape && event.key === "Escape" && this.#shown) {
        this.hide();
      }
    };

    this.#outsideHandler = (event) => {
      if (!this.#config.closeOnOutsideClick || !this.#shown) return;

      const target = event.target;

      if (this.#el?.contains(target)) return;
      if (this.#popover?.contains(target)) return;

      this.hide();
    };

    this.#toggleHandler = (event) => {
      event.preventDefault();
      this.toggle();
    };

    if (trigger === "click") {
      this.#el.addEventListener("click", this.#toggleHandler);
    }

    document.addEventListener("keydown", this.#escapeHandler);
  }

  /**
   * Build and attach the popover, then position it on a later animation frame.
   */
  show() {
    if (this.#isDisposed || this.#shown || !this.#el) return;

    if (!this.#dispatch("hygular.popover.show", true) || this.#isDisposed)
      return;

    const fragment = this.#getContentFragment();
    const title = String(this.#config.title ?? "").trim();

    if (!title && !fragment) return;

    this.#popover = document.createElement("div");
    this.#popover.id = this.#id;
    this.#popover.className = this.#class.popover;
    this.#popover.setAttribute("role", "dialog");

    if (this.#config.hasArrow) {
      this.#popover.classList.add(this.#class.arrow);
    }

    if (title) {
      const header = document.createElement("div");
      header.className = this.#class.header;
      header.id = `${this.#id}-title`;
      header.textContent = title;

      this.#popover.setAttribute("aria-labelledby", header.id);
      this.#popover.appendChild(header);
    }

    if (fragment) {
      const body = document.createElement("div");
      body.className = this.#class.body;
      body.appendChild(fragment);
      this.#popover.appendChild(body);
    }

    this.#el.setAttribute("aria-expanded", "true");
    this.#el.setAttribute("aria-controls", this.#id);

    document.body.appendChild(this.#popover);

    const popover = this.#popover;
    DomUtils.afterPaint(() => {
      if (this.#isDisposed || !this.#shown || this.#popover !== popover) return;

      this.update();
      this.#popover.classList.add(this.#class.active);
      this.#dispatch("hygular.popover.shown");
    });

    this.#shown = true;
    this.#startAutoUpdate();

    if (this.#config.closeOnOutsideClick) {
      DomUtils.afterPaint(() => {
        if (this.#isDisposed || !this.#shown || this.#popover !== popover)
          return;
        document.addEventListener("pointerdown", this.#outsideHandler);
      });
    }
  }

  /**
   * Request hiding, remove the popover, and dispose the instance if autoClean is
   * enabled.
   */
  hide() {
    if (!this.#shown || this.#isDisposed || this.#hiding) return;
    this.#hiding = true;
    try {
      if (!this.#dispatch("hygular.popover.hide", true) || this.#isDisposed)
        return;
      this.#removePopover();
      this.#dispatch("hygular.popover.hidden");
      if (this.#config?.autoClean && !this.#shown) this.dispose();
    } finally {
      this.#hiding = false;
    }
  }

  /** Remove the popup and stop outside-click and position handlers. */
  #removePopover() {
    this.#stopAutoUpdate();
    this.#el?.ownerDocument.removeEventListener(
      "pointerdown",
      this.#outsideHandler,
    );
    this.#popover?.remove();
    this.#popover = null;
    this.#shown = false;
    this.#el?.setAttribute("aria-expanded", "false");
    this.#el?.removeAttribute("aria-controls");
  }

  /**
   * Toggle the popover's visibility.
   */
  toggle() {
    if (this.#shown) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Recalculate placement and update the popover position.
   */
  update() {
    if (!this.#shown || !this.#popover || !this.#el) return;

    this.#clearPlacement();

    const resolved = this.#resolvePlacement();
    const { side, align } = resolved;

    this.#popover.classList.add(this.#class[side]);

    if (align && this.#class[align]) {
      this.#popover.classList.add(this.#class[align]);
    }

    this.#applyPosition(side, align);
  }

  /**
   * Clone target markup or a supplied DOM node; treat other content as plain text.
   */
  #getContentFragment() {
    const target = this.#config.target
      ? document.querySelector(this.#config.target)
      : null;

    if (target) {
      const template = document.createDocumentFragment();

      [...target.childNodes].forEach((node) => {
        template.appendChild(node.cloneNode(true));
      });

      return template.childNodes.length ? template : null;
    }

    const content = this.#config.content;

    if (content instanceof Node) {
      const fragment = document.createDocumentFragment();
      fragment.appendChild(content.cloneNode(true));
      return fragment;
    }

    const text = String(content ?? "").trim();
    if (!text) return null;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  /**
   * Try the preferred placement first, then fall back to the ranked sides.
   */
  #resolvePlacement() {
    const preferred = this.#normalizePlacement(this.#config.placement);
    const placements =
      preferred.side === "auto"
        ? this.#rankPlacements()
        : [preferred, ...this.#rankPlacements()];

    const unique = placements.filter((item, index, array) => {
      return (
        array.findIndex(
          (x) => x.side === item.side && x.align === item.align,
        ) === index
      );
    });

    return unique.find((placement) => this.#fits(placement.side)) || unique[0];
  }

  /**
   * Rank sides by available viewport space.
   */
  #rankPlacements() {
    const rect = this.#el.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const space = {
      top: rect.top,
      bottom: winH - rect.bottom,
      left: rect.left,
      right: winW - rect.right,
    };

    return ["bottom", "top", "right", "left"]
      .sort((a, b) => space[b] - space[a])
      .map((side) => ({ side, align: "center" }));
  }

  /**
   * Check the available space on one side, including the configured offset.
   */
  #fits(side) {
    if (!this.#popover || !this.#el) return false;

    const rect = this.#el.getBoundingClientRect();
    const popoverRect = this.#popover.getBoundingClientRect();

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const offset = this.#config.offset;

    const space = {
      top: rect.top,
      bottom: winH - rect.bottom,
      left: rect.left,
      right: winW - rect.right,
    };

    if (side === "top" || side === "bottom") {
      return space[side] >= popoverRect.height + offset;
    }

    return space[side] >= popoverRect.width + offset;
  }

  /**
   * Position the popover in document coordinates and constrain it to the viewport
   * where possible.
   */
  #applyPosition(side, align = "center") {
    const rect = this.#el.getBoundingClientRect();
    const popoverRect = this.#popover.getBoundingClientRect();

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    const offset = this.#config.offset;

    let top = 0;
    let left = 0;

    if (side === "top") {
      top = rect.top + scrollY - popoverRect.height - offset;
      left = this.#alignedLeft(rect, popoverRect, align) + scrollX;
    }

    if (side === "bottom") {
      top = rect.bottom + scrollY + offset;
      left = this.#alignedLeft(rect, popoverRect, align) + scrollX;
    }

    if (side === "left") {
      top = this.#alignedTop(rect, popoverRect, align) + scrollY;
      left = rect.left + scrollX - popoverRect.width - offset;
    }

    if (side === "right") {
      top = this.#alignedTop(rect, popoverRect, align) + scrollY;
      left = rect.right + scrollX + offset;
    }

    const padding = 8;

    left = Math.max(
      padding + scrollX,
      Math.min(left, window.innerWidth + scrollX - popoverRect.width - padding),
    );

    top = Math.max(
      padding + scrollY,
      Math.min(
        top,
        window.innerHeight + scrollY - popoverRect.height - padding,
      ),
    );

    Object.assign(this.#popover.style, {
      position: "absolute",
      top: `${top}px`,
      left: `${left}px`,
    });
  }

  /**
   * Calculate horizontal alignment relative to the trigger.
   */
  #alignedLeft(rect, popoverRect, align) {
    if (align === "start") return rect.left;
    if (align === "end") return rect.right - popoverRect.width;
    return rect.left + rect.width / 2 - popoverRect.width / 2;
  }

  /**
   * Calculate vertical alignment relative to the trigger.
   */
  #alignedTop(rect, popoverRect, align) {
    if (align === "start") return rect.top;
    if (align === "end") return rect.bottom - popoverRect.height;
    return rect.top + rect.height / 2 - popoverRect.height / 2;
  }

  /**
   * Falls back to "click" for unrecognized trigger values.
   */
  #normalizeTrigger(value) {
    return ["click", "manual"].includes(value) ? value : "click";
  }

  /** Normalize the side and alignment, falling back to auto and center. */
  #normalizePlacement(value) {
    const allowedSides = ["auto", "top", "bottom", "left", "right"];
    const allowedAligns = ["start", "end"];

    const raw = String(value || "auto").trim();
    const [side, align] = raw.split("-");

    return {
      side: allowedSides.includes(side) ? side : "auto",
      align: allowedAligns.includes(align) ? align : "center",
    };
  }

  /**
   * Remove previous placement classes before applying a new position.
   */
  #clearPlacement() {
    this.#popover.classList.remove(
      this.#class.top,
      this.#class.bottom,
      this.#class.left,
      this.#class.right,
      this.#class.start,
      this.#class.end,
    );
  }

  /**
   * Update placement on resize and scroll, including scrolls in nested containers.
   */
  #startAutoUpdate() {
    if (this.#updateHandler) return;

    this.#updateHandler = () => this.update();

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
   * Dispatch an event on the trigger. Return false if a cancelable event is
   * prevented.
   */
  #dispatch(name, cancelable = false) {
    if (!this.#el) return false;

    const event = new CustomEvent(name, {
      bubbles: true,
      cancelable,
      detail: {
        instance: this,
        trigger: this.#el,
        popover: this.#popover,
      },
    });

    return this.#el.dispatchEvent(event);
  }

  /**
   * Generate an ID for the popover and its ARIA references.
   */
  #uniqueId() {
    return `hygular-popover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Return the instance attached to an element, if any.
   */
  static getInstance(element) {
    return Popover.#instances.get(element);
  }

  /**
   * Initialize matching elements, reusing existing instances.
   */
  static init(
    selector = '[data-hygular-toggle="popover"], [data-hygular="popover"]',
  ) {
    if (typeof document === "undefined") return [];

    return [...document.querySelectorAll(selector)].map((el) => {
      return Popover.#instances.get(el) || new Popover(el);
    });
  }

/**
 * Remove the popover, detach listeners, restore ARIA attributes, and clear
 * instance references.
 */
  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    this.#removePopover();
    this.#el?.removeEventListener("click", this.#toggleHandler);
    this.#el?.ownerDocument.removeEventListener("keydown", this.#escapeHandler);
    this.#originalAria?.forEach((value, name) => {
      if (value === null) this.#el?.removeAttribute(name);
      else this.#el?.setAttribute(name, value);
    });
    Popover.#instances.delete(this.#el);
    this.#originalAria = null;
    this.#el = null;
    this.#config = null;
    this.#id = null;
  }
}
