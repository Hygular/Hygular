/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

export default class DomUtils {
  static #slides = new WeakMap();

  /** Cancel only the slide owned by this utility. */
  static cancelSlide(element) {
    DomUtils.#slides.get(element)?.();
  }

  /**
   * Animate height and margins to zero, then hide the element. Optionally remove
   * it from the DOM.
   */
  static slideUp(el, duration = 350, removeAfter = false) {
    return new Promise((resolve) => {
      if (!el) return resolve();

      DomUtils.cancelSlide(el);
      const height = el.getBoundingClientRect().height;
      if (height === 0) {
        el.style.display = "none";
        if (removeAfter) el.remove();
        return resolve();
      }

      const saved = ["height", "overflow", "margin-top", "margin-bottom"].map(
        (name) => [
          name,
          el.style.getPropertyValue(name),
          el.style.getPropertyPriority(name),
        ],
      );
      const restore = () =>
        saved.forEach(([name, value, priority]) => {
          if (value) el.style.setProperty(name, value, priority);
          else el.style.removeProperty(name);
        });
      el.style.overflow = "hidden";
      el.style.height = height + "px";
      el.style.marginTop = getComputedStyle(el).marginTop;
      el.style.marginBottom = getComputedStyle(el).marginBottom;

      const animation = el.animate(
        [
          {
            height: height + "px",
            marginTop: getComputedStyle(el).marginTop,
            marginBottom: getComputedStyle(el).marginBottom,
          },
          { height: "0px", marginTop: "0px", marginBottom: "0px" },
        ],
        { duration, easing: "ease-out", fill: "forwards" },
      );

      let settled = false;
      const finish = (completed) => {
        if (settled) return;
        settled = true;
        animation.onfinish = animation.oncancel = null;
        if (DomUtils.#slides.get(el) === cancel) DomUtils.#slides.delete(el);
        animation.cancel();
        restore();
        if (completed) {
          el.style.display = "none";
          if (removeAfter) el.remove();
        }
        resolve();
      };
      const cancel = () => finish(false);
      DomUtils.#slides.set(el, cancel);
      animation.onfinish = () => finish(true);
      animation.oncancel = cancel;
    });
  }

  /**
   * Show the element and animate it to its content height.
   */
  static slideDown(el, duration = 350, display = "block") {
    return new Promise((resolve) => {
      if (!el) return resolve();

      DomUtils.cancelSlide(el);
      el.style.display = display;
      void el.offsetHeight; // Flush layout before measuring the expanded height.

      const height = el.scrollHeight;
      const cs = getComputedStyle(el);

      const animation = el.animate(
        [
          {
            height: "0px",
            overflow: "hidden",
            marginTop: "0px",
            marginBottom: "0px",
          },
          {
            height: height + "px",
            overflow: "hidden",
            marginTop: cs.marginTop,
            marginBottom: cs.marginBottom,
          },
        ],
        { duration, easing: "ease-out", fill: "forwards" },
      );

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        animation.onfinish = animation.oncancel = null;
        if (DomUtils.#slides.get(el) === finish) DomUtils.#slides.delete(el);
        animation.cancel();
        resolve();
      };
      DomUtils.#slides.set(el, finish);
      animation.onfinish = animation.oncancel = finish;
    });
  }

  /**
   * Bind Escape dismissal for a visible element. Return a function that removes
   * the handler.
   */
  static closeOnEscape(el, toggler, duration = 350) {
    const document = el?.ownerDocument;
    if (!document?.defaultView) return () => {};
    if (el._escapeHandler)
      document.removeEventListener("keydown", el._escapeHandler);
    let disposed = false;
    let closing = false;
    const handler = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || closing) return;
      if (document.defaultView.getComputedStyle(el).display === "none") return;
      closing = true;
      document.removeEventListener("keydown", handler);
      DomUtils.slideUp(el, duration).then(() => {
        if (!disposed && toggler) toggler.classList.remove("is-active");
        if (el._escapeHandler === handler) el._escapeHandler = null;
      });
    };
    el._escapeHandler = handler;
    document.addEventListener("keydown", handler);
    return () => {
      disposed = true;
      document.removeEventListener("keydown", handler);
      if (el._escapeHandler === handler) el._escapeHandler = null;
      if (closing) DomUtils.cancelSlide(el);
    };
  }

  /**
   * Run the callback after two animation frame callbacks.
   */
  static afterPaint(callback) {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  }
}
