/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DomUtils from "../utils/DomUtils.js";
import ScrollLock from "../utils/ScrollLock.js";
import DelegateRegistry from "../utils/DelegateRegistry.js";
export default class Components {
  static #accordionId = 0;
  /**
   * Restore persisted alert dismissals and bind the dismiss handler. Return its
   * cleanup function.
   */
  static alert() {
    return DelegateRegistry.subscribe("alert", Components.#bindAlert);
  }

  static #bindAlert(document) {
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
          return document.defaultView.localStorage.getItem(key);
        } catch (e) {
          return null;
        }
      },
      set: (key, val) => {
        try {
          document.defaultView.localStorage.setItem(key, val);
        } catch (e) {}
      },
    };

    let disposed = false;
    const dismissals = new Map();
    const refresh = () => {
      document
        .querySelectorAll(
          `${CONFIG.selector}[${CONFIG.attrs.persistent}="true"]`,
        )
        .forEach((alert) => {
          if (dismissals.has(alert)) return;
          const key = alert.getAttribute(CONFIG.attrs.dismissKey);
          if (key && storage.get(`dismissed-${key}`)) alert.remove();
        });
    };
    const clickHandler = (evt) => {
      const closeBtn = evt.target.closest(CONFIG.selectors.closeBtn);
      const alert = closeBtn?.closest(CONFIG.selector);
      if (disposed || !alert || dismissals.has(alert)) return;
      evt.preventDefault();

      const operation = { timer: null, onEnd: null, restore: null };
      dismissals.set(alert, operation);
      const closeEvent = new CustomEvent("hygular.alert.close", {
        detail: { alert },
        cancelable: true,
      });
      alert.dispatchEvent(closeEvent);
      if (
        disposed ||
        closeEvent.defaultPrevented ||
        !document.contains(alert)
      ) {
        dismissals.delete(alert);
        return;
      }
      const finish = () => {
        if (disposed || dismissals.get(alert) !== operation) return;
        clearTimeout(operation.timer);
        alert.removeEventListener("transitionend", operation.onEnd);
        // Keep the operation registered while removal invokes application code.
        alert.remove();
        dismissals.delete(alert);
        if (alert.getAttribute(CONFIG.attrs.persistent) === "true") {
          const key = alert.getAttribute(CONFIG.attrs.dismissKey);
          if (key) storage.set(`dismissed-${key}`, "true");
        }
        document.dispatchEvent(
          new CustomEvent("hygular.alert.closed", {
            detail: { alert },
          }),
        );
      };
      const saved = ["display", "transition", "opacity"].map((name) => [
        name,
        alert.style.getPropertyValue(name),
        alert.style.getPropertyPriority(name),
      ]);
      operation.restore = () =>
        saved.forEach(([name, value, priority]) => {
          if (value) alert.style.setProperty(name, value, priority);
          else alert.style.removeProperty(name);
        });
      if (alert.getAttribute(CONFIG.attrs.animation) === "slide") {
        DomUtils.slideUp(alert, 300).then(finish);
      } else {
        operation.onEnd = (event) => {
          if (event.target === alert && event.propertyName === "opacity")
            finish();
        };
        alert.style.transition = "opacity 0.25s ease";
        alert.style.opacity = "0";
        alert.addEventListener("transitionend", operation.onEnd);
        operation.timer = setTimeout(finish, 350);
      }
    };
    document.addEventListener("click", clickHandler);
    return {
      refresh,
      dispose() {
        disposed = true;
        document.removeEventListener("click", clickHandler);
        dismissals.forEach((operation, alert) => {
          clearTimeout(operation.timer);
          alert.removeEventListener("transitionend", operation.onEnd);
          DomUtils.cancelSlide(alert);
          operation.restore?.();
        });
        dismissals.clear();
      },
    };
  }

  /**
   * Bind accordion toggles and apply the initial open state. Return listener
   * cleanup.
   */
  static accordion() {
    return DelegateRegistry.subscribe("accordion", Components.#bindAccordion);
  }

  static #bindAccordion(document) {
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

    let disposed = false;
    const roots = new WeakSet();
    const buttons = new WeakSet();
    const locks = new Set();
    const panels = new Set();
    const clickHandler = async (evt) => {
      const toggler = evt.target.closest(CONFIG.selectors.toggler);
      if (
        disposed ||
        !toggler ||
        toggler.disabled ||
        toggler.getAttribute("aria-disabled") === "true" ||
        toggler.classList.contains(CONFIG.classes.disabled)
      )
        return;
      const root = toggler.closest(CONFIG.selector);
      if (!root) return;

      if (locks.has(root)) return;
      locks.add(root);
      evt.preventDefault();

      const allowMultiple = root.getAttribute("data-allow-multiple") === "true";
      const isOpen = toggler.classList.contains(CONFIG.classes.open);

      try {
        if (isOpen) {
          await accordionClose(toggler);
        } else {
          const openedSuccessfully = await accordionOpen(toggler);
          if (!disposed && openedSuccessfully && !allowMultiple) {
            const others = [
              ...root.querySelectorAll(CONFIG.selectors.toggler),
            ].filter(
              (btn) =>
                btn !== toggler && btn.classList.contains(CONFIG.classes.open),
            );
            await Promise.all(others.map((btn) => accordionClose(btn)));
          }
        }
      } finally {
        locks.delete(root);
      }
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

    const refresh = () =>
      document.querySelectorAll(CONFIG.selector).forEach((root) => {
        root.querySelectorAll(CONFIG.selectors.toggler).forEach((button) => {
          const content = button.parentElement.querySelector(
            CONFIG.selectors.content,
          );
          if (content && !buttons.has(button)) {
            buttons.add(button);
            syncState(
              button,
              content,
              button.classList.contains(CONFIG.classes.open),
            );
          }
        });
        if (roots.has(root)) return;
        const first = root.querySelector(CONFIG.selectors.toggler);
        if (!first) return;
        roots.add(root);
        if (root.getAttribute("data-open-first") !== "true") return;
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

    return {
      refresh,
      dispose() {
        disposed = true;
        document.removeEventListener("click", clickHandler);
        panels.forEach((panel) => {
          DomUtils.cancelSlide(panel);
          const button = panel.parentElement?.querySelector(
            CONFIG.selectors.toggler,
          );
          panel.style.display = button?.classList.contains(CONFIG.classes.open)
            ? "block"
            : "none";
        });
        panels.clear();
        locks.clear();
      },
    };

    async function accordionClose(btn) {
      const item = btn.parentElement;
      const content = item.querySelector(CONFIG.selectors.content);
      if (disposed || !content) return false;

      const closeEvent = new CustomEvent("hygular.accordion.close", {
        detail: { trigger: btn, content, item },
        bubbles: true,
        cancelable: true,
      });
      item.dispatchEvent(closeEvent);
      if (disposed || closeEvent.defaultPrevented || !document.contains(item))
        return false;

      btn.classList.remove(CONFIG.classes.open);
      syncState(btn, content, false);
      panels.add(content);
      await DomUtils.slideUp(content, 200);
      panels.delete(content);
      if (disposed || !document.contains(item)) return false;

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
      if (disposed || !content) return false;

      const openEvent = new CustomEvent("hygular.accordion.open", {
        detail: { trigger: btn, content, item },
        bubbles: true,
        cancelable: true,
      });
      item.dispatchEvent(openEvent);
      if (disposed || openEvent.defaultPrevented || !document.contains(item))
        return false;

      btn.classList.add(CONFIG.classes.open);
      syncState(btn, content, true);
      panels.add(content);
      await DomUtils.slideDown(content, 200);
      panels.delete(content);
      if (disposed || !document.contains(item)) return false;

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
    return DelegateRegistry.subscribe("collapse", Components.#bindCollapse);
  }

  static #bindCollapse(document) {
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

    const locks = new Set();
    const targets = new WeakSet();
    const buttons = new WeakMap();
    let disposed = false;

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

        if (buttons.get(btn) === target) return;
        buttons.set(btn, target);
        if (targets.has(target)) {
          updateState(
            btn,
            target,
            target.classList.contains(CONFIG.classes.open),
          );
          return;
        }
        targets.add(target);
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
      if (
        disposed ||
        btn.disabled ||
        btn.getAttribute("aria-disabled") === "true"
      )
        return;

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

      if (
        disposed ||
        startEvent.defaultPrevented ||
        !document.contains(target)
      ) {
        locks.delete(target);
        return;
      }

      updateState(btn, target, !isOpen);

      if (isOpen) {
        await DomUtils.slideUp(target, CONFIG.defaults.duration);
      } else {
        await DomUtils.slideDown(target, CONFIG.defaults.duration);
      }

      if (disposed || !document.contains(target)) {
        locks.delete(target);
        return;
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

    document.addEventListener("click", clickHandler);

    return {
      refresh: setInitialState,
      dispose() {
        disposed = true;
        document.removeEventListener("click", clickHandler);
        locks.forEach((target) => {
          DomUtils.cancelSlide(target);
          target.style.display = target.classList.contains(CONFIG.classes.open)
            ? "block"
            : "none";
        });
        locks.clear();
      },
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

/**
 * Bind delegated navbar toggles. Return cleanup for click and Escape handlers
 * and pending menu animations.
 */
  static navbar() {
    const CONFIG = {
      trigger: '[data-hygular-toggle="navbar"]',

      selectors: {
        menu: ".navbar-menu",
      },

      classes: {
        toggle: "is-active",
      },
    };

    const lockMap = new WeakMap();
    const menus = new Set();
    let disposed = false;

    const handler = async (e) => {
      const btn = e.target.closest(CONFIG.trigger);
      if (!btn) return;

      e.preventDefault();
      const targetSelector = btn.getAttribute("data-target");
      if (!targetSelector) return;

      const menu = document.querySelector(targetSelector);
      if (!menu) return;

      if (disposed || lockMap.get(menu)) return;
      menus.add(menu);
      menu._disposeEsc?.();
      menu._disposeEsc = null;
      lockMap.set(menu, true);

      const isOpen = btn.classList.contains(CONFIG.classes.toggle);

      document.querySelectorAll(CONFIG.selectors.menu).forEach((el) => {
        if (el !== menu)
          DomUtils.slideUp(el).finally(() => lockMap.set(el, false));
      });
      document.querySelectorAll(CONFIG.trigger).forEach((el) => {
        if (el !== btn) el.classList.remove(CONFIG.classes.toggle);
      });

      if (isOpen) {
        btn.classList.remove(CONFIG.classes.toggle);
        await DomUtils.slideUp(menu, 300);
      } else {
        btn.classList.add(CONFIG.classes.toggle);
        await DomUtils.slideDown(menu, 300, "flex");
        if (disposed) return;
        const disposeEsc = DomUtils.closeOnEscape(menu, btn, 300);
        menu._disposeEsc = disposeEsc;
      }

      lockMap.set(menu, false);
    };

    document.body.addEventListener("click", handler);
    return () => {
      disposed = true;
      document.body.removeEventListener("click", handler);
      menus.forEach((menu) => {
        menu._disposeEsc?.();
        menu._disposeEsc = null;
        menu.getAnimations?.().forEach((animation) => animation.cancel());
      });
      menus.clear();
    };
  }

  /**
   * Bind dropdown click, Escape, and supported hover interactions. Return listener
   * cleanup.
   */
  static dropdown() {
    const CONFIG = {
      selector: ".dropdown",

      trigger: '[data-hygular-toggle="dropdown"]',

      selectors: {
        menu: ".dropdown-menu",
      },

      classes: {
        active: "is-active",
      },

      attrs: {
        triggerMode: "data-trigger",
      },
    };

    const toggleDropdown = (drop, show) => {
      show
        ? drop.classList.add(CONFIG.classes.active)
        : drop.classList.remove(CONFIG.classes.active);
      const trigger = drop.querySelector(CONFIG.trigger);
      if (trigger)
        trigger.setAttribute("aria-expanded", show ? "true" : "false");
    };

    const closeAll = (except = null) => {
      document
        .querySelectorAll(`${CONFIG.selector}.${CONFIG.classes.active}`)
        .forEach((drop) => {
          if (drop !== except) toggleDropdown(drop, false);
        });
    };
    const clickHandler = (evt) => {
      const trigger = evt.target.closest(CONFIG.trigger);
      const isInsideMenu = evt.target.closest(CONFIG.selectors.menu);

      if (isInsideMenu) {
        const link = evt.target.closest("a");
        if (link) {
          const drop = isInsideMenu.closest(CONFIG.selector);
          if (drop) toggleDropdown(drop, false);
        }
        return;
      }

      if (!trigger) {
        closeAll();
        return;
      }

      const drop = trigger.closest(CONFIG.selector);
      if (!drop) return;

      closeAll(drop);
      const isActive = drop.classList.contains(CONFIG.classes.active);
      toggleDropdown(drop, !isActive);
    };

    const keyHandler = (evt) => {
      if (evt.key === "Escape" || evt.key === "Esc") closeAll();
    };

    document.addEventListener("click", clickHandler);
    document.addEventListener("keydown", keyHandler);

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const hoverTimers = new WeakMap();

      const mouseoverHandler = (evt) => {
        const hoverEl = evt.target.closest(
          `${CONFIG.selector}[${CONFIG.attrs.triggerMode}="hover"]`,
        );
        if (!hoverEl) return;
        if (hoverTimers.has(hoverEl)) {
          clearTimeout(hoverTimers.get(hoverEl));
          hoverTimers.delete(hoverEl);
        }
        closeAll(hoverEl);
        toggleDropdown(hoverEl, true);
      };

      const mouseoutHandler = (evt) => {
        const hoverEl = evt.target.closest(
          `${CONFIG.selector}[${CONFIG.attrs.triggerMode}="hover"]`,
        );
        if (!hoverEl) return;
        if (hoverTimers.has(hoverEl)) clearTimeout(hoverTimers.get(hoverEl));
        const timer = setTimeout(() => {
          if (!hoverEl.matches(":hover") && !hoverEl.querySelector(":hover")) {
            toggleDropdown(hoverEl, false);
          }
          hoverTimers.delete(hoverEl);
        }, 150);
        hoverTimers.set(hoverEl, timer);
      };

      document.addEventListener("mouseover", mouseoverHandler);
      document.addEventListener("mouseout", mouseoutHandler);

      return () => {
        document.removeEventListener("click", clickHandler);
        document.removeEventListener("keydown", keyHandler);
        document.removeEventListener("mouseover", mouseoverHandler);
        document.removeEventListener("mouseout", mouseoutHandler);
      };
    }

    return () => {
      document.removeEventListener("click", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }

  /**
   * Initialize tab state, keyboard navigation, and the optional indicator. Return
   * an object with cleanup.
   */
  static tabview(tabContainer) {
    // Skip DOM setup outside the browser.
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    if (!tabContainer) return;

    const CONFIG = {
      attrs: {
        tab: "data-tab",
        indicator: "data-tab-indicator",
      },
      classes: {
        active: "is-active",
        open: "is-open",
        underline: "tab-indicator",
        instant: "is-instant",
      },
    };

    const tabs = Array.from(
      tabContainer.querySelectorAll(`[${CONFIG.attrs.tab}]`),
    );
    if (!tabs.length) return;

    const indicator = tabContainer.getAttribute(CONFIG.attrs.indicator);
    const hasUiIndicator = indicator === "true" || indicator === "";

    let underline = tabContainer.querySelector(`.${CONFIG.classes.underline}`);
    const weCreatedUnderline = hasUiIndicator && !underline;

    if (hasUiIndicator) {
      if (getComputedStyle(tabContainer).position === "static") {
        tabContainer.style.position = "relative";
      }
      if (!underline) {
        underline = document.createElement("div");
        underline.className = CONFIG.classes.underline;
        tabContainer.appendChild(underline);
      }
      underline.style.display = "";
    } else if (underline) {
      underline.style.display = "none";
    }

    const panelMap = new Map();
    tabs.forEach((tab) => {
      const sel = tab.getAttribute(CONFIG.attrs.tab);
      const panel = sel ? document.querySelector(sel) : null;
      if (panel) panelMap.set(sel, panel);

      if (!tab.id) tab.id = `tab-${Math.random().toString(36).slice(2, 9)}`;
      tab.setAttribute("role", "tab");

      if (panel) {
        if (!panel.id)
          panel.id = `panel-${Math.random().toString(36).slice(2, 9)}`;
        tab.setAttribute("aria-controls", panel.id);
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id);
      }
    });

    tabContainer.setAttribute("role", "tablist");

    const indicatorSize =
      parseFloat(
        getComputedStyle(tabContainer).getPropertyValue("--tab-indicator-size"),
      ) || 3;

    let pendingRaf = null;
    let disposed = false;

    const measure = (el) => {
      const containerRect = tabContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      return {
        left: elRect.left - containerRect.left + tabContainer.scrollLeft,
        top: elRect.top - containerRect.top + tabContainer.scrollTop,
        width: elRect.width,
        height: elRect.height,
      };
    };

    const readLayout = () => {
      const style = getComputedStyle(tabContainer);
      const flexDir = style.flexDirection;
      return {
        vertical: flexDir === "column" || flexDir === "column-reverse",
        rtl: style.direction === "rtl",
      };
    };

    function updateIndicator(instant = false) {
      if (!hasUiIndicator || !underline) return;

      const activeTab = tabContainer.querySelector(`.${CONFIG.classes.active}`);
      if (!activeTab) return;

      if (activeTab.offsetWidth === 0 && activeTab.offsetHeight === 0) return;

      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);

      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = null;

        const { left, top, width, height } = measure(activeTab);
        const { vertical, rtl } = readLayout();

        let x, y, w, h;

        if (vertical) {
          // Place a vertical indicator at the inline-start edge.
          w = Math.round(indicatorSize);
          h = Math.round(height);
          y = Math.round(top);
          x = rtl ? Math.round(left + width - indicatorSize) : Math.round(left);
        } else {
          // Place a horizontal indicator along the bottom edge.
          w = Math.round(width);
          h = Math.round(indicatorSize);
          x = Math.round(left);
          y = Math.round(top + height - indicatorSize);
        }

        if (instant) underline.classList.add(CONFIG.classes.instant);

        underline.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        underline.style.width = `${w}px`;
        underline.style.height = `${h}px`;

        if (instant) {
          void underline.offsetWidth;
          requestAnimationFrame(() =>
            underline.classList.remove(CONFIG.classes.instant),
          );
        }
      });
    }

    // Update tab state, panel visibility, and the indicator together.
    function setActiveTab(tab, { focus = false } = {}) {
      tabs.forEach((t) => {
        const isActive = t === tab;
        t.classList.toggle(CONFIG.classes.active, isActive);
        t.setAttribute("aria-selected", String(isActive));
        t.tabIndex = isActive ? 0 : -1;
      });

      panelMap.forEach((panel) => panel.classList.remove(CONFIG.classes.open));

      const sel = tab.getAttribute(CONFIG.attrs.tab);
      const panel = panelMap.get(sel);
      if (panel) panel.classList.add(CONFIG.classes.open);

      updateIndicator();
      if (focus) tab.focus();
    }

    const initialActive =
      tabContainer.querySelector(`.${CONFIG.classes.active}`) || tabs[0];
    setActiveTab(initialActive);

    if (underline) updateIndicator(true);

    const clickHandler = (evt) => {
      const tab = evt.target.closest(`[${CONFIG.attrs.tab}]`);
      if (!tab || !tabContainer.contains(tab)) return;
      if (tab.classList.contains(CONFIG.classes.active)) return;

      evt.preventDefault();
      setActiveTab(tab);
    };

    // Move focus and activate tabs with Left, Right, Home, and End.
    const keydownHandler = (evt) => {
      const currentTab = evt.target.closest(`[${CONFIG.attrs.tab}]`);
      if (!currentTab || !tabContainer.contains(currentTab)) return;

      const currentIndex = tabs.indexOf(currentTab);
      if (currentIndex === -1) return;

      let nextIndex = null;
      switch (evt.key) {
        case "ArrowRight":
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case "ArrowLeft":
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      evt.preventDefault();
      setActiveTab(tabs[nextIndex], { focus: true });
    };

    tabContainer.addEventListener("click", clickHandler);
    tabContainer.addEventListener("keydown", keydownHandler);

    // Update the indicator when the tab container or individual tabs resize.
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateIndicator())
        : null;
    if (resizeObserver) {
      resizeObserver.observe(tabContainer);
      tabs.forEach((t) => resizeObserver.observe(t));
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!disposed) updateIndicator();
      });
    }

    return {
      dispose: () => {
        disposed = true;
        if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
        tabContainer.removeEventListener("click", clickHandler);
        tabContainer.removeEventListener("keydown", keydownHandler);
        if (resizeObserver) resizeObserver.disconnect();
        if (
          weCreatedUnderline &&
          underline &&
          underline.parentNode === tabContainer
        ) {
          underline.remove();
        }
      },
    };
  }

  /**
   * Enable pointer dragging on the swiper wrapper. Return an object with listener
   * cleanup.
   */
  static swiper(element) {
    if (!element) return;

    const wrapper = element.querySelector(".swiper-wrapper");
    if (!wrapper) return;

    let isDragging = false;
    let startX = 0;
    let scrollStart = 0;
    let moved = false;
    const DRAG_THRESHOLD = 3; // px

    const onPointerDown = (e) => {
      isDragging = true;
      moved = false;

      element.classList.add("is-dragging");

      startX = e.clientX;
      scrollStart = wrapper.scrollLeft;

      wrapper.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;

      const delta = e.clientX - startX;

      if (Math.abs(delta) > DRAG_THRESHOLD) {
        moved = true;
      }

      const movement = delta * 1.15;
      wrapper.scrollLeft = scrollStart - movement;
    };

    const onPointerUpOrCancel = (e) => {
      if (!isDragging) return;

      isDragging = false;
      element.classList.remove("is-dragging");

      wrapper.releasePointerCapture(e.pointerId);

      // Suppress the click produced by a drag so links are not activated accidentally.
      if (moved) {
        const preventClick = (ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        };

        wrapper.addEventListener("click", preventClick, {
          capture: true,
          once: true,
        });
      }
    };

    wrapper.addEventListener("pointerdown", onPointerDown, { passive: true });
    wrapper.addEventListener("pointermove", onPointerMove, { passive: false });
    wrapper.addEventListener("pointerup", onPointerUpOrCancel, {
      passive: true,
    });
    wrapper.addEventListener("pointercancel", onPointerUpOrCancel, {
      passive: true,
    });
    wrapper.addEventListener("pointerleave", onPointerUpOrCancel, {
      passive: true,
    });

    return {
      dispose: () => {
        wrapper.removeEventListener("pointerdown", onPointerDown);
        wrapper.removeEventListener("pointermove", onPointerMove);
        wrapper.removeEventListener("pointerup", onPointerUpOrCancel);
        wrapper.removeEventListener("pointercancel", onPointerUpOrCancel);
        wrapper.removeEventListener("pointerleave", onPointerUpOrCancel);
      },
    };
  }
}