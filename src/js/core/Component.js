/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DomUtils from "../utils/DomUtils.js";
import ScrollLock from "../utils/ScrollLock.js";
export default class Components {
  /**
   * Restore persisted alert dismissals and bind the dismiss handler. Return its
   * cleanup function.
   */
  static alert() {
    const CONFIG = {
      selector: '[data-hygular="alert"]',

      selectors: {
        closeBtn: ".alert-close",
      },

      attrs: {
        persistent: "data-persistent",
        dismissKey: "data-dismiss-key",
        animation: "data-close-animation",
      },
    };

    const storage = {
      get: (key) => {
        try {
          return localStorage.getItem(key);
        } catch (e) {
          return null;
        }
      },
      set: (key, val) => {
        try {
          localStorage.setItem(key, val);
        } catch (e) {}
      },
    };

    document
      .querySelectorAll(`${CONFIG.selector}[${CONFIG.attrs.persistent}="true"]`)
      .forEach((alert) => {
        const key = alert.getAttribute(CONFIG.attrs.dismissKey);
        if (key && storage.get(`dismissed-${key}`)) alert.remove();
      });
    const clickHandler = (evt) => {
      const closeBtn = evt.target.closest(CONFIG.selectors.closeBtn);
      if (!closeBtn) return;

      const alertElement = closeBtn.closest(CONFIG.selector);
      if (!alertElement) return;

      evt.preventDefault();

      const closeEvent = new CustomEvent("hygular.alert.close", {
        detail: { alert: alertElement },
        cancelable: true,
      });
      alertElement.dispatchEvent(closeEvent);
      if (closeEvent.defaultPrevented) return;

      if (alertElement.getAttribute(CONFIG.attrs.persistent) === "true") {
        const key = alertElement.getAttribute(CONFIG.attrs.dismissKey);
        if (key) {
          storage.set(`dismissed-${key}`, "true");
        }
      }

      const dismissMode = alertElement.getAttribute(CONFIG.attrs.animation);
      let isRemoved = false;

      const finalizeDismiss = () => {
        if (isRemoved) return;
        isRemoved = true;
        document.dispatchEvent(
          new CustomEvent("hygular.alert.closed", {
            detail: { alert: alertElement },
          }),
        );
        alertElement.remove();
      };

      if (dismissMode === "slide") {
        DomUtils.slideUp(alertElement, 300).then(finalizeDismiss);
      } else {
        alertElement.style.transition = "opacity 0.25s ease";
        alertElement.style.opacity = "0";
        alertElement.addEventListener("transitionend", finalizeDismiss, {
          once: true,
        });
        setTimeout(finalizeDismiss, 350);
      }
    };

    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }
}