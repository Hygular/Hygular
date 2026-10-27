/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DomUtils from "../utils/DomUtils.js";
import Debug from "../core/Debug.js";

export default class Toast {
  // Instance registry
  static #instances = new Map();
  static #counter = 0;

  /**
   * Return the registry of toast instances keyed by ID.
   */
  static get instances() {
    return Toast.#instances;
  }

  #id = null;
  #config = null;
  #el = null;
  #progressEl = null;
  #timeoutId = null;
  #handleClick;
  #container = null;

  // Default options
  #defaults = {
    message: "Hi, I am a toast message",
    status: "default",
    position: "bottom",
    duration: 4000,
    dismissPrevious: false,
    showIcon: false,
    autoClean: false,
  };

  // DOM selectors and marker classes
  #selector = {
    rootParent: "body",
    toastBase: "toast",
    generated: "generated-by-hygular",
  };

  // Position and visibility classes
  #class = {
    active: "is-active",
    posTop: "is-top",
    posBottom: "is-bottom",
  };

  #variantMap = {
    success: "is-success",
    danger: "is-danger",
    warning: "is-warning",
    info: "is-info",
    default: "is-default",
  };

  /**
   * Merge options, constrain the duration, and register the instance.
   */
  constructor(options = {}) {
    this.#config = { ...this.#defaults, ...options };

    // Limit the display duration to 1–10 seconds.
    this.#config.duration = Math.min(
      Math.max(parseInt(this.#config.duration) || 0, 1000),
      10000,
    );

    // Assign an ID and register the instance before mounting.
    this.#id = `toast-${++Toast.#counter}`;
    Toast.#instances.set(this.#id, this);
  }

  /**
   * Create and display a toast, returning its instance.
   */
  static show(options = {}) {
    const t = new Toast(options);
    t.build();
    return t;
  }

  /**
   * Mount the toast in its position-specific container and start automatic
   * dismissal.
   */
  build() {
    if (!this.#config || this.#el) return;
    // Skip mounting outside the browser.
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    Toast.#instances.set(this.#id, this);
    const parent =
      this.#selector.rootParent instanceof Element
        ? this.#selector.rootParent
        : document.querySelector(this.#selector.rootParent) || document.body;

    const containerClass = `hygular-toast-container-${this.#config.position}`;
    let container = parent.querySelector(`.${containerClass}`);

    if (!container) {
      container = document.createElement("div");
      container.className = `hygular-toast-container ${containerClass}`;
      parent.appendChild(container);
    }

    this.#container = container;

    if (this.#config.dismissPrevious) {
      this.#removeExistingToasts(this.#container);
    }

    this.#create(this.#container);
    this.#setup();
    this.#startAutoClose();
  }

  /**
   * Stop automatic dismissal, remove the toast element, and unregister the
   * instance.
   */
  dismiss() {
    this.#clearAutoClose();
    this.#teardownElement();
    Toast.#instances.delete(this.#id);
    if (this.#config?.autoClean) this.dispose();
  }

  /**
   * Build the message and progress elements, then schedule the entry state.
   */
  #create(parent) {
    const el = document.createElement("div");
    el.classList.add(this.#selector.toastBase, this.#selector.generated);
    el.setAttribute("data-toast-id", this.#id);
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    if (this.#config.showIcon) {
      const icon = document.createElement("span");
      icon.className = "toast-icon";
      el.appendChild(icon);
    }

    const content = document.createElement("span");
    content.className = "toast-message";
    content.textContent = this.#config.message;
    el.appendChild(content);

    const progress = document.createElement("div");
    progress.className = "toast-progress";
    el.appendChild(progress);

    parent.appendChild(el);

    // Retain the elements needed for animation and cleanup.
    this.#el = el;
    this.#progressEl = progress;

    DomUtils.afterPaint(() => {
      if (this.#el === el) el.classList.add(this.#class.active);
    });
  }

  /**
   * Bind click dismissal and apply position, status, and icon classes.
   */
  #setup() {
    if (!(this.#el instanceof Element)) {
      Debug.warn(`[Toast] Target element was not found.`);
      return;
    }
    this.#handleClick = () => this.dismiss();
    this.#el.addEventListener("click", this.#handleClick);

    const posClass =
      this.#config.position === "top"
        ? this.#class.posTop
        : this.#class.posBottom;
    this.#el.classList.add(posClass);
    const variantClass =
      this.#variantMap[this.#config.status] ?? this.#variantMap.default;
    this.#el.classList.add(variantClass);
    if (this.#config.showIcon) this.#el.classList.add("has-icon");
  }

  /**
   * Animate the progress bar and schedule removal after the configured duration.
   */
  #startAutoClose() {
    if (!this.#progressEl || !this.#el) return;

    this.#progressEl.style.width = "100%";

    const progress = this.#progressEl;
    DomUtils.afterPaint(() => {
      if (this.#progressEl !== progress) return;

      this.#progressEl.style.transition = `width ${this.#config.duration}ms linear`;

      this.#progressEl.style.width = "0%";
    });

    this.#timeoutId = setTimeout(() => {
      if (this.#el && this.#el.parentNode) {
        this.dismiss();
      }
      this.#timeoutId = null;
    }, this.#config.duration);
  }

  /**
   * Cancel the removal timer and clear the progress transition.
   */
  #clearAutoClose() {
    if (this.#timeoutId) {
      clearTimeout(this.#timeoutId);
      this.#timeoutId = null;
    }
    if (this.#progressEl) {
      this.#progressEl.style.transition = "";
    }
  }

  /**
   * Detach the click handler and remove the toast element.
   */
  #teardownElement() {
    if (!this.#el) return;

    if (this.#handleClick) {
      this.#el.removeEventListener("click", this.#handleClick);
    }

    try {
      if (this.#el.parentNode) {
        this.#el.parentNode.removeChild(this.#el);
      }
    } catch (e) {}

    this.#el = null;
    this.#progressEl = null;
    this.#handleClick = null;
  }

  /**
   * Dismiss previous toasts in this container, including their timers and handlers.
   */
  #removeExistingToasts(parent) {
    parent.querySelectorAll(`.${this.#selector.generated}`).forEach((node) => {
      const instance = Toast.#instances.get(node.getAttribute("data-toast-id"));
      if (instance) instance.dismiss();
      else node.remove();
    });
  }

  /**
   * Cancel automatic dismissal, unregister the instance, and clear its state.
   */
  dispose() {
    this.#clearAutoClose();
    this.#teardownElement();
    Toast.#instances.delete(this.#id);
    this.#id = null;
    this.#config = null;
  }
}
