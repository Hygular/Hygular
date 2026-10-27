/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DomUtils from "../utils/DomUtils.js";
import ScrollLock from "../utils/ScrollLock.js";

export default class Modal {
  // Shared request queue
  static #queue = [];
  static #processingQueue = false;

  static TRANSITION_DURATION = 280;
  static TRANSITION_BUFFER = 60;

  static #closeHandlers = new WeakMap();

  /**
   * Append a dialog request and start processing the queue if idle.
   */
  static enqueue(item) {
    Modal.#queue.push(item);
    Modal.#processQueue();
  }

  /**
   * Process queued dialogs in order, awaiting each result before starting the
   * next.
   */
  static async #processQueue() {
    if (Modal.#processingQueue) return;
    Modal.#processingQueue = true;

    while (Modal.#queue.length) {
      const item = Modal.#queue.shift();
      try {
        const modal = new Modal(item.type, item.options);
        const result = modal.build();
        if (result instanceof Promise) {
          const value = await result;
          item.resolve?.(value);
        } else {
          item.resolve?.(undefined);
        }
      } catch (err) {
        item.reject?.(err);
      }
    }

    Modal.#processingQueue = false;
  }

  /**
   * Open a dialog immediately or enqueue it, returning its result as a promise.
   */
  static #open(type, options = {}, useQueue = false) {
    if (typeof document === "undefined" || typeof window === "undefined")
      return Promise.resolve(type === "confirm" ? false : undefined);
    return new Promise((resolve, reject) => {
      if (useQueue) {
        Modal.enqueue({ type, options, resolve, reject });
        return;
      }

      const modal = new Modal(type, options);
      modal.build().then(resolve).catch(reject);
    });
  }

  /**
   * Open a confirmation dialog and return its result.
   */
  static confirm(options = {}) {
    return Modal.#open("confirm", options);
  }

  /**
   * Open an alert dialog and return a promise for its completion.
   */
  static alert(options = {}) {
    return Modal.#open("default", options);
  }

  /**
   * Open an existing modal element. Resolve immediately outside the browser.
   */
  static custom(options = {}) {
    // No DOM work is needed during server rendering.
    if (typeof window === "undefined" || typeof document === "undefined") {
      return Promise.resolve();
    }
    return Modal.#open("custom", options);
  }

  static queue = {
    alert: (options = {}) => Modal.#open("default", options, true),
    confirm: (options = {}) => Modal.#open("confirm", options, true),
  };

  // CSS class names
  #class = {
    opened: "is-open",
    align: { top: "is-top", center: "is-center", bottom: "is-bottom" },
  };

  #config = null;
  #modal = null;
  #dialog = null;
  #header = null;
  #body = null;
  #actionsWrap = null;
  #backdrop = null;
  #promiseResolve = null;
  #isDisposed = false;
  #closing = false;
  #locked = false;
  #timers = new Set();
  #previousFocus = null;
  #focusHandler = null;
  static #scrollLock = new ScrollLock();
  static #lockCount = 0;

  #handlers = {
    esc: null,
    backdropClick: null,
    dismissClick: null,
    confirmClick: null,
    transitionEnd: null,
  };

  /**
   * Acquire a shared scroll lock when the first modal opens.
   */
  static #lockBodyScroll() {
    Modal.#lockCount += 1;

    if (Modal.#lockCount === 1) {
      Modal.#scrollLock.lock();
    }
  }

  /**
   * Release the shared scroll lock when the modal count reaches zero.
   */
  static #unlockBodyScroll() {
    Modal.#lockCount = Math.max(0, Modal.#lockCount - 1);

    if (Modal.#lockCount === 0) {
      Modal.#scrollLock.unlock();
    }
  }

  /**
   * Validate the dialog type, merge its options, and bind action handlers.
   */
  constructor(type, options = {}) {
    if (!["default", "confirm", "custom"].includes(type)) {
      throw new Error(
        `Invalid modal type "${type}". Must be: default, confirm, custom`,
      );
    }

    // Options by dialog type
    const defaults = {
      default: {
        heading: undefined,
        content: "This is a Modal message",
        align: "center",
        dispose: false,
        dismissText: "OK",
        icon: { visible: false, type: "none" },
        guardMode: false,
        guardButtonText: "Go here",
        guardButtonClass: "",
        guardButtonUrl: "",
        closeOnEsc: true,
        backdrop: true,
        backdropClose: true,
        focusFirst: true,
        onOpen: null,
        onOpened: null,
        onClose: null,
        onClosed: null,
      },
      confirm: {
        heading: undefined,
        content: "Are you sure?",
        align: "center",
        dispose: false,
        actions: { cancelText: "No", confirmText: "Yes" },
        closeOnEsc: false,
        backdrop: true,
        backdropClose: false,
        focusFirst: true,
        onOpen: null,
        onOpened: null,
        onClose: null,
        onClosed: null,
      },
      custom: {
        id: "#",
        onOpen: null,
        onOpened: null,
        onClose: null,
        onClosed: null,
        closeOnEsc: true,
        backdropClose: true,
        focusFirst: true,
      },
    };
    this.type = type;
    this.#config = { ...defaults[type], ...options };
    if (type === "confirm")
      this.#config.actions = {
        ...defaults.confirm.actions,
        ...options.actions,
      };
    this.#config.icon = {
      visible: false,
      type: "none",
      ...(this.#config.icon || {}),
    };

    // Keep handler references for later removal.
    this.#handlers.esc = this.#handleEsc.bind(this);
    this.#handlers.dismissClick = this.#handleDismissClick.bind(this);
    this.#handlers.confirmClick = this.#handleConfirmClick.bind(this);
  }

  /**
   * Create the generated dialog and its backdrop; custom dialogs use existing
   * markup.
   */
  #create() {
    if (this.type === "custom") return;
    this.#backdrop = document.createElement("div");
    this.#backdrop.className = "modal-backdrop generated-by-hygular-backdrop";
    this.#modal = document.createElement("div");
    this.#modal.className = "modal generated-by-hygular";
    this.#modal.setAttribute("role", "dialog");
    this.#modal.setAttribute("aria-modal", "true");
    this.#dialog = document.createElement("div");
    this.#dialog.className = "modal-dialog";
    this.#header = document.createElement("div");
    this.#header.className = "modal-header";
    this.#body = document.createElement("div");
    this.#body.className = "modal-body";
    this.#dialog.append(this.#header, this.#body);
    this.#modal.append(this.#dialog);
    this.#backdrop.appendChild(this.#modal);
    document.body.appendChild(this.#backdrop);
  }

  /**
   * Set plain-text heading and body content, linking the heading to the dialog.
   */
  #applyText() {
    if (this.#config.heading) {
      this.#header.id = "hygular-modal-title-" + crypto.randomUUID();
      this.#header.textContent = this.#config.heading;
      this.#modal.setAttribute("aria-labelledby", this.#header.id);
    }
    this.#body.textContent = this.#config.content;
  }

  /**
   * Build the dialog actions, replacing them with a guard button when configured.
   */
  #addButtons() {
    this.#actionsWrap = document.createElement("div");
    this.#actionsWrap.className = "modal-actions";

    if (this.type === "default") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "button is-primary-ghost modal-close";
      btn.textContent = this.#config.dismissText;
      this.#actionsWrap.appendChild(btn);
    } else if (this.type === "confirm") {
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "button is-dark-ghost modal-close";
      cancel.textContent = this.#config.actions.cancelText;

      const confirm = document.createElement("button");
      confirm.type = "button";
      confirm.className = "button is-primary-ghost modal-confirm";
      confirm.textContent = this.#config.actions.confirmText;

      this.#actionsWrap.append(cancel, confirm);
    }

    this.#dialog.appendChild(this.#actionsWrap);

    if (this.#config.guardMode) {
      this.#actionsWrap.innerHTML = "";

      const gbtn = document.createElement("button");
      gbtn.type = "button";
      gbtn.className = "button";
      gbtn.textContent = this.#config.guardButtonText || "Go here";
      if (typeof this.#config.guardButtonClass === "string") {
        const safeClasses = this.#config.guardButtonClass
          .split(" ")
          .filter((c) => /^[a-z0-9-_]+$/i.test(c));
        gbtn.classList.add(...safeClasses);
      }
      gbtn.addEventListener("click", () => {
        if (this.#close("guard-exit") && this.#config.guardButtonUrl) {
          window.location.href = this.#config.guardButtonUrl;
        }
      });

      this.#actionsWrap.appendChild(gbtn);

      return;
    }
  }

  /**
   * Insert the configured status icon before the dialog content.
   */
  #addIcon() {
    const { icon } = this.#config;
    if (!icon.visible || icon.type === "none") return;

    const iconHTML = {
      success: `
    <div class="status-icon is-success is-animated">
      <svg class="status-svg" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
        <circle class="status-ring" cx="40" cy="40" r="32"></circle>
        <path class="status-mark" d="M25 41 L35 51 L56 29"></path>
      </svg>
    </div>
  `,
      error: `
    <div class="status-icon is-error is-animated">
      <svg class="status-svg" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
        <circle class="status-ring" cx="40" cy="40" r="32"></circle>
        <path class="status-mark" d="M28 28 L52 52"></path>
        <path class="status-mark is-second" d="M52 28 L28 52"></path>
      </svg>
    </div>
  `,
      warning: `
    <div class="status-icon is-warning is-animated">
      <svg class="status-svg" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
        <path class="status-ring" d="M40 12 L68 62 H12 Z" stroke-linejoin="round"></path>
        <path class="status-mark" d="M40 27 V45"></path>
        <circle class="status-dot" cx="40" cy="55" r="3.5"></circle>
      </svg>
    </div>
  `,
      info: `
    <div class="status-icon is-info is-animated">
      <svg class="status-svg" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
        <circle class="status-ring" cx="40" cy="40" r="32"></circle>
        <path class="status-mark" d="M40 37 V55"></path>
        <circle class="status-dot" cx="40" cy="25" r="3.5"></circle>
      </svg>
    </div>
  `,
    }[icon.type];

    if (iconHTML) this.#dialog.insertAdjacentHTML("afterbegin", iconHTML);
  }

  /**
   * Apply the requested vertical alignment, defaulting to center.
   */
  #setAlign() {
    const pos = this.#class.align[this.#config.align];
    if (pos) this.#modal.classList.add(pos);
    else this.#modal.classList.add(this.#class.align.center);
  }

  /**
   * Keep Tab navigation inside the dialog and optionally move initial focus.
   */
  #trapFocus() {
    this.#previousFocus = document.activeElement;
    if (!this.#dialog) return;
    this.#focusHandler = (event) => {
      if (event.key !== "Tab") return;
      const items = [
        ...this.#dialog.querySelectorAll(
          "a[href], button, input, select, textarea, [tabindex]",
        ),
      ].filter(
        (el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length,
      );
      const first = items[0];
      const last = items.at(-1);
      if (!first) {
        event.preventDefault();
        this.#dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          !items.includes(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !items.includes(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    this.#dialog.addEventListener("keydown", this.#focusHandler);
    if (this.#config.focusFirst) {
      this.#dialog.setAttribute("tabindex", "-1");
    }
  }

  /**
   * Handles Escape key interactions.
   */
  #handleEsc(e) {
    if (e.key === "Escape" && this.#config.closeOnEsc) {
      this.#close("esc");
    }
  }

  /**
   * Handles dismiss button interactions.
   */
  #handleDismissClick(e) {
    e.preventDefault();
    this.#close("dismiss");
  }

  /**
   * Handles confirm button interactions.
   */
  #handleConfirmClick(e) {
    e.preventDefault();
    this.#resolveConfirm();
  }

  /**
   * Open the generated or custom dialog and return its result promise.
   */
  build() {
    if (this.#isDisposed || this.#modal || typeof document === "undefined")
      return Promise.resolve(this.type === "confirm" ? false : undefined);
    if (this.type === "custom") return this.#runCustom();
    this.#create();
    this.#setAlign();
    this.#applyText();
    this.#addButtons();
    this.#addIcon();

    if (typeof this.#config.onOpen === "function") {
      const shouldOpen = this.#config.onOpen(this.#modal);
      if (this.#isDisposed)
        return Promise.resolve(this.type === "confirm" ? false : undefined);
      if (shouldOpen === false) {
        this.#backdrop.remove();
        return Promise.reject("Cancelled by onOpen callback");
      }
    }
    if (
      this.#config.backdrop &&
      this.#config.backdropClose &&
      !this.#config.guardMode
    ) {
      this.#handlers.backdropClick = (e) => {
        if (!this.#dialog.contains(e.target)) {
          this.#close("backdrop");
        }
      };
      this.#backdrop.addEventListener("click", this.#handlers.backdropClick);
    }

    if (this.#config.closeOnEsc && !this.#config.guardMode) {
      document.addEventListener("keydown", this.#handlers.esc);
    }
    this.#actionsWrap?.querySelectorAll(".modal-close")?.forEach((btn) => {
      btn.addEventListener("click", this.#handlers.dismissClick);
    });
    this.#actionsWrap?.querySelectorAll(".modal-confirm")?.forEach((btn) => {
      btn.addEventListener("click", this.#handlers.confirmClick);
    });
    return this.#startOpening();
  }

  /** Start the dialog lifecycle and ignore delayed work after closing or disposal. */
  #startOpening() {
    Modal.#lockBodyScroll();
    this.#locked = true;
    const result = new Promise((resolve) => {
      this.#promiseResolve = resolve;
    });
    this.#trapFocus();
    DomUtils.afterPaint(() => {
      if (this.#closing || this.#isDisposed) return;
      this.#modal.classList.add(this.#class.opened);
      if (this.#config.focusFirst) this.#dialog.focus();
    });
    const timer = setTimeout(() => {
      this.#timers.delete(timer);
      if (!this.#closing && !this.#isDisposed)
        this.#config.onOpened?.(this.#modal);
    }, Modal.TRANSITION_DURATION + Modal.TRANSITION_BUFFER);
    this.#timers.add(timer);
    return result;
  }

  /**
   * Request confirmation; resolve only after the close is accepted and completed.
   */
  #resolveConfirm() {
    this.#close("confirm");
  }

  /**
   * Request closure, then remove the generated dialog after the exit transition.
   */
  #close(reason = "dismiss") {
    if (this.#isDisposed || this.#closing || !this.#modal) return false;
    if (this.#config.onClose?.(this.#modal, reason) === false) return false;
    if (this.#isDisposed) return false;
    this.#closing = true;
    this.#clearPending();
    this.#detachHandlers();
    this.#modal.classList.remove(this.#class.opened);
    let finished = false;
    const done = () => {
      if (finished || this.#isDisposed) return;
      finished = true;
      this.#clearPending();
      this.#releaseLock();
      this.#backdrop?.remove();
      const resolve = this.#promiseResolve;
      this.#promiseResolve = null;
      this.#previousFocus?.isConnected && this.#previousFocus.focus();
      resolve?.(
        reason === "guard-exit"
          ? "guard-exit"
          : this.type === "confirm"
            ? reason === "confirm"
            : undefined,
      );
      try {
        this.#config.onClosed?.(this.#modal, reason);
      } finally {
        if (this.#config?.dispose) this.dispose();
      }
    };
    this.#handlers.transitionEnd = (event) => {
      if (event.target === this.#modal) done();
    };
    this.#modal.addEventListener("transitionend", this.#handlers.transitionEnd);
    const timer = setTimeout(
      done,
      Modal.TRANSITION_DURATION + Modal.TRANSITION_BUFFER,
    );
    this.#timers.add(timer);
    return true;
  }

  /** Cancel transition fallbacks and detach the pending completion listener. */
  #clearPending() {
    this.#timers.forEach(clearTimeout);
    this.#timers.clear();
    this.#modal?.removeEventListener(
      "transitionend",
      this.#handlers.transitionEnd,
    );
    this.#handlers.transitionEnd = null;
  }

  /** Detach the handlers owned by this dialog. */
  #detachHandlers() {
    this.#modal?.ownerDocument.removeEventListener(
      "keydown",
      this.#handlers.esc,
    );
    (this.#backdrop || this.#modal)?.removeEventListener(
      "click",
      this.#handlers.backdropClick,
    );
    this.#modal?.querySelectorAll(".modal-close").forEach((button) => {
      button.removeEventListener("click", this.#handlers.dismissClick);
      if (Modal.#closeHandlers.get(button) === this.#handlers.dismissClick)
        Modal.#closeHandlers.delete(button);
    });
    this.#modal
      ?.querySelectorAll(".modal-confirm")
      .forEach((button) =>
        button.removeEventListener("click", this.#handlers.confirmClick),
      );
    this.#dialog?.removeEventListener("keydown", this.#focusHandler);
  }

  /** Release this dialog's share of the scroll lock once. */
  #releaseLock() {
    if (!this.#locked) return;
    this.#locked = false;
    Modal.#unlockBodyScroll();
  }

  /**
   * Attach modal behavior to an existing element without generating replacement
   * markup.
   */
  #runCustom() {
    const el =
      this.#config.id instanceof Element
        ? this.#config.id
        : document.querySelector(this.#config.id);
    if (!el)
      return Promise.reject(
        new Error("Custom modal element not found: " + this.#config.id),
      );
    if (this.#config.onOpen?.(el) === false)
      return Promise.reject(new Error("Cancelled by onOpen"));
    this.#modal = el;
    this.#dialog = el.querySelector(".modal-dialog") || el;
    el.querySelectorAll(".modal-close").forEach((button) => {
      const previous = Modal.#closeHandlers.get(button);
      if (previous) button.removeEventListener("click", previous);
      Modal.#closeHandlers.set(button, this.#handlers.dismissClick);
      button.addEventListener("click", this.#handlers.dismissClick);
    });
    if (this.#config.closeOnEsc)
      document.addEventListener("keydown", this.#handlers.esc);
    if (this.#config.backdropClose) {
      this.#handlers.backdropClick = (event) => {
        if (!this.#dialog.contains(event.target)) this.#close("backdrop");
      };
      el.addEventListener("click", this.#handlers.backdropClick);
    }
    return this.#startOpening();
  }

  /**
   * Cancel pending work, release the scroll lock, and remove generated markup.
   */
  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    this.#clearPending();
    this.#detachHandlers();
    this.#releaseLock();
    this.#modal?.classList.remove(this.#class.opened);
    this.#backdrop?.remove();
    this.#promiseResolve?.(this.type === "confirm" ? false : undefined);
    if (this.#previousFocus?.isConnected) this.#previousFocus.focus();
    this.#previousFocus = null;
    this.#modal = null;
    this.#dialog = null;
    this.#header = null;
    this.#body = null;
    this.#actionsWrap = null;
    this.#backdrop = null;
    this.#promiseResolve = null;
    this.#config = null;
  }
}
