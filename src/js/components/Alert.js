/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DomUtils from "../utils/DomUtils.js";
import Debug from "../core/Debug.js";

export default class Alert {
  #selectorElement = null;
  #config = null;
  #clickHandler = null;
  #elements = new Set();
  #dismissals = new Map();
  #isDisposed = false;

  #supportedTypes = ["success", "danger", "warning", "info", "default"];

  // CSS class names
  #class = {
    icon: "has-icon",
    animated: "animation-none",
    bordered: "border-0",
    alertBase: "alert",
    closeBtn: "alert-close",
  };

  // Default options
  #defaults = {
    message: "This is an alert message",
    status: "default",
    hasIcon: false,
    dismissible: true,
    position: "before",
    animated: true,
    animation: "fade",
    bordered: false,
    autoClean: false,
  };

  /**
   * Create and insert an alert beside the target. Return null if the target is
   * unavailable.
   */
  static create(selector, options = {}) {
    const instance = new Alert(selector, options);
    if (!instance.#selectorElement) {
      Debug.warn(
        `[Alert] Target element "${selector}" was not found. Instance was not created.`,
      );
      return null;
    }
    instance.build();
    return instance;
  }

  /**
   * Resolve the target element and merge alert options.
   */
  constructor(selector, options = {}) {
    // Skip DOM setup outside the browser.
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    this.#selectorElement =
      selector instanceof Element ? selector : document.querySelector(selector);
    if (!(this.#selectorElement instanceof Element)) {
      Debug.warn(
        `[Alert] Target element "${selector}" was not found. Instance was not created.`,
      );
      return null;
    }
    this.#config = { ...this.#defaults, ...options };
    this.#clickHandler = this.#handleDismissClick.bind(this);
  }

  /**
   * Insert an alert before or after the target and bind its dismiss handler.
   */
  build() {
    if (this.#isDisposed || !this.#selectorElement) return;
    const alertEl = this.#createAlert();
    const insertPos =
      this.#config.position === "before" ? "beforebegin" : "afterend";
    this.#selectorElement.insertAdjacentElement(insertPos, alertEl);
    if (this.#config.dismissible) {
      alertEl.addEventListener("click", this.#clickHandler);
    }
    this.#elements.add(alertEl);
    return alertEl;
  }

  /**
   * Resolve the status class, falling back to the default variant.
   */
  #getStatusClass(prefix = "is-") {
    return this.#supportedTypes.includes(this.#config.status)
      ? `${prefix}${this.#config.status}`
      : `${prefix}default`;
  }

  /**
   * Build the alert from text content and an optional dismiss button.
   */
  #createAlert() {
    const classList = [
      this.#class.alertBase,
      this.#getStatusClass(),
      this.#config.hasIcon ? this.#class.icon : "",
      this.#config.animated === false ? this.#class.animated : "",
      this.#config.bordered === false ? this.#class.bordered : "",
    ]
      .filter(Boolean)
      .join(" ");

    const container = document.createElement("div");
    container.setAttribute("role", "alert");
    const span = document.createElement("span");
    container.className = classList;
    span.className = "alert-content";

    span.appendChild(document.createTextNode(this.#config.message));
    container.appendChild(span);

    if (this.#config.dismissible) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `button ${this.#class.closeBtn}`;
      btn.setAttribute("aria-label", "Dismiss alert");
      container.appendChild(btn);
    }

    return container;
  }

  /**
   * Remove the alert after its configured dismiss animation.
   */
  #handleDismissClick(evt) {
    if (this.#isDisposed) return;
    const target = evt.target.closest(`.${this.#class.closeBtn}`);
    const alertEl = target?.closest(`.${this.#class.alertBase}`);
    if (
      !alertEl ||
      !this.#elements.has(alertEl) ||
      this.#dismissals.has(alertEl)
    )
      return;
    evt.preventDefault();
    alertEl.removeEventListener("click", this.#clickHandler);

    if (this.#config.animation === "slide") {
      this.#dismissals.set(alertEl, () => {
        alertEl.getAnimations?.().forEach((animation) => animation.cancel());
      });
      DomUtils.slideUp(alertEl, 200, true).then(() => this.#finalize(alertEl));
    } else {
      const onEnd = (event) => {
        if (event.target === alertEl && event.propertyName === "opacity") {
          this.#finalize(alertEl);
        }
      };
      const timer = setTimeout(() => this.#finalize(alertEl), 250);
      this.#dismissals.set(alertEl, () => {
        clearTimeout(timer);
        alertEl.removeEventListener("transitionend", onEnd);
      });
      alertEl.addEventListener("transitionend", onEnd);
      alertEl.style.transition = "opacity 0.2s ease";
      alertEl.style.opacity = "0";
    }
  }

  /**
   * Remove the alert element and clear instance references if requested.
   */
  #finalize(el) {
    if (!this.#elements.has(el)) return;
    this.#dismissals.get(el)?.();
    this.#dismissals.delete(el);
    el.removeEventListener("click", this.#clickHandler);
    el.remove();
    this.#elements.delete(el);
    if (this.#config?.autoClean) this.dispose();
  }

  /**
   * Cancel pending dismissals, remove generated alerts, and release references.
   */
  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    this.#dismissals.forEach((cancel) => cancel());
    this.#dismissals.clear();
    this.#elements.forEach((el) => {
      el.removeEventListener("click", this.#clickHandler);
      el.remove();
    });
    this.#elements.clear();
    this.#selectorElement = null;
    this.#config = null;
    this.#clickHandler = null;
  }
}
