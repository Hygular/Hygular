/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

export default class DomUtils {

  /**
   * Animate height and margins to zero, then hide the element. Optionally remove
   * it from the DOM.
   */
  static slideUp(el, duration = 350, removeAfter = false) {
    return new Promise((resolve) => {
      if (!el) return resolve();

      const height = el.getBoundingClientRect().height;
      if (height === 0) {
        el.style.display = "none";
        if (removeAfter) el.remove();
        return resolve();
      }

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

      animation.onfinish = () => {
        animation.cancel();
        el.style.height = el.style.overflow = "";
        el.style.marginTop = el.style.marginBottom = "";
        el.style.display = "none";
        if (removeAfter) el.remove();
        resolve();
      };

      animation.oncancel = resolve;
    });
  }

  /**
   * Show the element and animate it to its content height.
   */
  static slideDown(el, duration = 350, display = "block") {
    return new Promise((resolve) => {
      if (!el) return resolve();

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

      animation.onfinish = () => {
        animation.cancel();
        resolve();
      };

      animation.oncancel = resolve;
    });
  }

  /**
   * Bind Escape dismissal for a visible element. Return a function that removes
   * the handler.
   */
  static closeOnEscape(el, toggler, duration = 350) {
    if (typeof window === "undefined" || typeof document === "undefined")
      return () => {};
    if (el._escapeHandler) {
      document.removeEventListener("keydown", el._escapeHandler);
    }

    const handler = (e) => {
      if (e.key !== "Escape") return;
      if (getComputedStyle(el).display === "none") return;

      DomUtils.slideUp(el, duration).then(() => {
        if (toggler) toggler.classList.remove("is-active");
      });

      document.removeEventListener("keydown", el._escapeHandler);
      el._escapeHandler = null;
    };

    el._escapeHandler = handler;
    document.addEventListener("keydown", handler);

    return () => {
      document.removeEventListener("keydown", el._escapeHandler);
      el._escapeHandler = null;
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
