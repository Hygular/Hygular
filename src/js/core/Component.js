/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DomUtils from "../utils/DomUtils.js";
import ScrollLock from "../utils/ScrollLock.js";
export default class Components {
  static #accordionId = 0;
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

  /**
   * Bind accordion toggles and apply the initial open state. Return listener
   * cleanup.
   */
  static accordion() {
    const CONFIG = {
      selector: '[data-hygular="accordion"]',
      classes: {
        open: "is-open",
        disabled: "is-disabled",
      },

      selectors: {
        toggler: ".accordion-toggler",
        content: ".accordion-content",
      },

      attrs: {
        expanded: "aria-expanded",
      },
    };

    const clickHandler = async (evt) => {
      const toggler = evt.target.closest(CONFIG.selectors.toggler);
      if (
        !toggler ||
        toggler.disabled ||
        toggler.getAttribute("aria-disabled") === "true" ||
        toggler.classList.contains(CONFIG.classes.disabled)
      )
        return;
      const root = toggler.closest(CONFIG.selector);
      if (!root) return;

      if (root.accordionLock) return;
      root.accordionLock = true;

      const allowMultiple = root.getAttribute("data-allow-multiple") === "true";
      const isOpen = toggler.classList.contains(CONFIG.classes.open);

      if (isOpen) {
        await accordionClose(toggler);
      } else {
        const openedSuccessfully = await accordionOpen(toggler);
        if (openedSuccessfully && !allowMultiple) {
          const others = [
            ...root.querySelectorAll(CONFIG.selectors.toggler),
          ].filter(
            (btn) =>
              btn !== toggler && btn.classList.contains(CONFIG.classes.open),
          );
          await Promise.all(others.map((btn) => accordionClose(btn)));
        }
      }

      root.accordionLock = false;
    };

    const syncState = (button, content, open) => {
      button.setAttribute(CONFIG.attrs.expanded, String(open));
      if (!content.id) {
        let id;
        do {
          id = `hygular-accordion-${++Components.#accordionId}`;
        } while (document.getElementById(id));
        content.id = id;
      }
      button.setAttribute("aria-controls", content.id);
    };

    document.querySelectorAll(CONFIG.selector).forEach((root) => {
      root.querySelectorAll(CONFIG.selectors.toggler).forEach((button) => {
        const content = button.parentElement.querySelector(
          CONFIG.selectors.content,
        );
        if (content) {
          syncState(
            button,
            content,
            button.classList.contains(CONFIG.classes.open),
          );
        }
      });
      if (root.getAttribute("data-open-first") !== "true") return;
      const first = root.querySelector(CONFIG.selectors.toggler);
      if (!first) return;

      first.classList.add(CONFIG.classes.open);

      const content = first.parentElement.querySelector(
        CONFIG.selectors.content,
      );
      if (content) {
        content.style.display = "block";
        syncState(first, content, true);
      }
    });

    document.addEventListener("click", clickHandler);

    return () => document.removeEventListener("click", clickHandler);

    async function accordionClose(btn) {
      const item = btn.parentElement;
      const content = item.querySelector(CONFIG.selectors.content);
      if (!content) return false;

      const closeEvent = new CustomEvent("hygular.accordion.close", {
        detail: { trigger: btn, content, item },
        bubbles: true,
        cancelable: true,
      });
      item.dispatchEvent(closeEvent);
      if (closeEvent.defaultPrevented) return false;

      btn.classList.remove(CONFIG.classes.open);
      syncState(btn, content, false);
      await DomUtils.slideUp(content, 200);

      item.dispatchEvent(
        new CustomEvent("hygular.accordion.closed", {
          detail: { trigger: btn, content, item },
          bubbles: true,
        }),
      );

      return true;
    }

    async function accordionOpen(btn) {
      const item = btn.parentElement;
      const content = item.querySelector(CONFIG.selectors.content);
      if (!content) return false;

      const openEvent = new CustomEvent("hygular.accordion.open", {
        detail: { trigger: btn, content, item },
        bubbles: true,
        cancelable: true,
      });
      item.dispatchEvent(openEvent);
      if (openEvent.defaultPrevented) return false;

      btn.classList.add(CONFIG.classes.open);
      syncState(btn, content, true);
      await DomUtils.slideDown(content, 200);

      item.dispatchEvent(
        new CustomEvent("hygular.accordion.opened", {
          detail: { trigger: btn, content, item },
          bubbles: true,
        }),
      );

      return true;
    }
  }

  /**
   * Read data-count and display values of 100 or more as 99+.
   */
  static badge(element) {
    const countRaw = element.getAttribute("data-count");
    if (!countRaw) return;

    const count = Number(countRaw);
    if (Number.isNaN(count)) return;

    element.textContent = count < 100 ? count : "99+";
    element.setAttribute("aria-label", `${count}`);
  }

  /**
   * Initialize collapse state and bind delegated toggles. Return the listener
   * cleanup function.
   */
  static collapse() {
    const CONFIG = {
      trigger: '[data-hygular-toggle="collapse"]',

      attrs: {
        target: "data-target",
      },

      classes: {
        open: "is-open",
      },

      defaults: {
        duration: 300,
      },
    };

    const locks = new WeakSet();

    const updateState = (btn, target, isOpen) => {
      btn.classList.toggle(CONFIG.classes.open, isOpen);
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");

      if (target.id) {
        btn.setAttribute("aria-controls", target.id);
      }

      target.classList.toggle(CONFIG.classes.open, isOpen);
      target.setAttribute("data-state", isOpen ? "open" : "closed");
    };

    const setInitialState = () => {
      document.querySelectorAll(CONFIG.trigger).forEach((btn) => {
        const targetSelector = btn.getAttribute(CONFIG.attrs.target);
        if (!targetSelector) return;

        const target = document.querySelector(targetSelector);
        if (!target) return;

        const isOpen =
          btn.classList.contains(CONFIG.classes.open) ||
          target.classList.contains(CONFIG.classes.open) ||
          target.getAttribute("data-initial-open") === "true";

        updateState(btn, target, isOpen);

        if (isOpen) {
          target.style.display = "block";
        } else {
          target.style.display = "none";
        }
      });
    };

    const toggleCollapse = async (btn) => {
      if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return;

      const targetSelector = btn.getAttribute(CONFIG.attrs.target);
      if (!targetSelector) return;

      const target = document.querySelector(targetSelector);
      if (!target) return;

      if (locks.has(target)) return;
      locks.add(target);

      const isOpen = target.classList.contains(CONFIG.classes.open);

      const eventName = isOpen ? "close" : "open";
      const startEvent = new CustomEvent(`hygular.collapse.${eventName}`, {
        detail: { trigger: btn, target },
        bubbles: true,
        cancelable: true,
      });

      target.dispatchEvent(startEvent);

      if (startEvent.defaultPrevented) {
        locks.delete(target);
        return;
      }

      updateState(btn, target, !isOpen);

      if (isOpen) {
        await DomUtils.slideUp(target, CONFIG.defaults.duration);
      } else {
        await DomUtils.slideDown(target, CONFIG.defaults.duration);
      }

      target.dispatchEvent(
        new CustomEvent(`hygular.collapse.${isOpen ? "closed" : "opened"}`, {
          detail: { trigger: btn, target },
          bubbles: true,
        }),
      );

      locks.delete(target);
    };

    const clickHandler = (evt) => {
      const btn = evt.target.closest(CONFIG.trigger);
      if (!btn) return;

      evt.preventDefault();
      toggleCollapse(btn);
    };

    setInitialState();

    document.addEventListener("click", clickHandler);

    return () => {
      document.removeEventListener("click", clickHandler);
    };
  }

  /**
   * Bind drawer controls, focus handling, and scroll locking. Return the cleanup
   * function.
   */
  static drawer() {
    const CONFIG = {
      parent: ".drawer",

      selectors: {
        dismissBtn: ".drawer-close",
        panel: ".drawer-panel",
        focusable:
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      },

      classes: {
        open: "is-open",
      },

      attrs: {
        target: "data-target",
      },

      defaults: {
        transitionDuration: 420,
      },
    };

    let activeDrawer = null;
    let disposed = false;
    const timers = new Set();
    const transitions = new Map();
    const drawers = new Set();
    // Track delayed drawer work so disposal can cancel it.
    const schedule = (callback, delay) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!disposed) callback();
      }, delay);
      timers.add(timer);
    };
    let drawerLock = false;
    const scrollLock = new ScrollLock();

    const trapFocus = (drawer) => {
      const focusables = Array.from(
        drawer.querySelectorAll(CONFIG.selectors.focusable),
      ).filter((el) => el.offsetParent !== null);
      if (!focusables.length) {
        drawer.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      const keyHandler = (e) => {
        if (e.key !== "Tab") return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };

      drawer._focusHandler = keyHandler;
      drawer.addEventListener("keydown", keyHandler);
      first.focus();
    };

    const releaseFocusTrap = (drawer) => {
      if (drawer._focusHandler) {
        drawer.removeEventListener("keydown", drawer._focusHandler);
        drawer._focusHandler = null;
      }
    };

    const isNavigationalLink = (link) => {
      if (!link) return false;
      if (
        link.hasAttribute("data-hygular-toggle") ||
        link.closest("[data-hygular-toggle]")
      ) {
        return false;
      }
      const href = link.getAttribute("href");
      if (href === null) return false; // An anchor without href is not a navigation target.
      const trimmed = href.trim();
      if (trimmed === "" || trimmed === "#") return false;
      if (trimmed.toLowerCase().startsWith("javascript:")) return false;
      return true;
    };

    const openDrawer = (drawer) => {
      if (
        disposed ||
        drawerLock ||
        drawer.classList.contains(CONFIG.classes.open)
      )
        return;

      const openEvent = new CustomEvent("hygular.drawer.open", {
        detail: { drawer },
        bubbles: true,
        cancelable: true,
      });
      drawer.dispatchEvent(openEvent);
      if (openEvent.defaultPrevented || disposed) return;

      drawerLock = true;
      activeDrawer = drawer;
      drawers.add(drawer);
      drawer.setAttribute("aria-modal", "true");
      drawer.setAttribute("role", "dialog");
      drawer.setAttribute("tabindex", "-1");

      if (!drawer.classList.contains("has-no-backdrop")) {
        scrollLock.lock();
      }

      DomUtils.afterPaint(() => {
        if (!disposed && activeDrawer === drawer && drawers.has(drawer))
          drawer.classList.add(CONFIG.classes.open);
      });

      schedule(() => {
        if (activeDrawer !== drawer) return;
        trapFocus(drawer);
        drawerLock = false;
        drawer.dispatchEvent(
          new CustomEvent("hygular.drawer.opened", {
            detail: { drawer },
            bubbles: true,
          }),
        );
      }, CONFIG.defaults.transitionDuration + 50);
    };

    const closeDrawer = (drawer) => {
      if (!drawer.classList.contains(CONFIG.classes.open)) return;
      const closeEvent = new CustomEvent("hygular.drawer.close", {
        detail: { drawer },
        bubbles: true,
        cancelable: true,
      });
      drawer.dispatchEvent(closeEvent);
      if (closeEvent.defaultPrevented) return;
      if (activeDrawer === drawer) activeDrawer = null;

      drawerLock = true;
      drawer.classList.remove(CONFIG.classes.open);
      drawer.removeAttribute("aria-modal");
      drawer.removeAttribute("role");
      releaseFocusTrap(drawer);

      let transitioned = false;
      const cleanup = () => {
        if (transitioned) return;
        transitioned = true;
        drawer.removeEventListener("transitionend", handler);
        transitions.delete(drawer);
        drawers.delete(drawer);
        drawerLock = false;
        if (!drawer.classList.contains("has-no-backdrop")) {
          scrollLock.unlock();
        }
        drawer.dispatchEvent(
          new CustomEvent("hygular.drawer.closed", {
            detail: { drawer },
            bubbles: true,
          }),
        );
      };

      const handler = (e) => {
        if (
          e.target !== drawer &&
          e.target !== drawer.querySelector(CONFIG.selectors.panel)
        )
          return;
        drawer.removeEventListener("transitionend", handler);
        cleanup();
      };

      transitions.set(drawer, handler);
      drawer.addEventListener("transitionend", handler);
      schedule(cleanup, CONFIG.defaults.transitionDuration + 50);
    };

    const clickHandler = (evt) => {
      const trigger = evt.target.closest('[data-hygular-toggle="drawer"]');
      const dismissBtn = evt.target.closest(CONFIG.selectors.dismissBtn);

      if (trigger) {
        evt.preventDefault();
        const selector = trigger.getAttribute(CONFIG.attrs.target);
        const drawer = selector
          ? document.querySelector(selector)
          : trigger.closest(CONFIG.parent);
        if (!drawer) return;
        openDrawer(drawer);
        return;
      }

      if (dismissBtn) {
        evt.preventDefault();
        const drawer = dismissBtn.closest(CONFIG.parent);
        if (drawer) closeDrawer(drawer);
        return;
      }

      if (activeDrawer) {
        const link = evt.target.closest("a");
        if (link && activeDrawer.contains(link) && isNavigationalLink(link)) {
          closeDrawer(activeDrawer);
        }
      }

      if (
        activeDrawer &&
        activeDrawer.classList.contains(CONFIG.classes.open)
      ) {
        const panel = activeDrawer.querySelector(CONFIG.selectors.panel);
        if (
          panel &&
          !panel.contains(evt.target) &&
          !evt.target.closest('[data-hygular-toggle="drawer"]')
        ) {
          closeDrawer(activeDrawer);
        }
      }
    };

    const keyHandler = (evt) => {
      if ((evt.key === "Escape" || evt.key === "Esc") && activeDrawer) {
        closeDrawer(activeDrawer);
      }
    };

    document.addEventListener("click", clickHandler);
    document.addEventListener("keydown", keyHandler);

    return () => {
      document.removeEventListener("click", clickHandler);
      document.removeEventListener("keydown", keyHandler);
      disposed = true;
      timers.forEach(clearTimeout);
      timers.clear();
      transitions.forEach((handler, drawer) =>
        drawer.removeEventListener("transitionend", handler),
      );
      transitions.clear();
      drawers.forEach((drawer) => {
        drawer.classList.remove(CONFIG.classes.open);
        drawer.removeAttribute("aria-modal");
        drawer.removeAttribute("role");
        releaseFocusTrap(drawer);
      });
      drawers.clear();
      activeDrawer = null;
      scrollLock.unlock();
    };
  }
}