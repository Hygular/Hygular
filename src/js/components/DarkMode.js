/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

export default class DarkMode {
  #config;
  #root;
  #container;
  #toggleButton;
  #input = null;
  #storageKey = "darkMode";
  #customBtnListener;
  #customBtn = null;
  #mediaQueryListener = null;
  #mediaQuery = null;
  #onChangeCallbacks = [];

  /**
   * Initialize theme controls and restore the stored or system theme preference.
   */
  constructor(options = {}) {
    // Skip DOM setup outside the browser.
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    this.#root = document.documentElement;

    const defaults = {
      container: "body",
      customBtn: false,
      autoCreateBtn: true,
    };
    this.#config = { ...defaults, ...options };
    this.#container =
      document.querySelector(this.#config.container) || document.body;
    this.#init();
  }

  /**
   * Create a checkbox-based theme switch in the configured container.
   */
  #createButton() {
    this.#toggleButton = document.createElement("label");
    this.#toggleButton.classList.add("dark-mode-toggler");
    if (this.#config.container === "body") {
      this.#toggleButton.classList.add("is-fixed");
      this.#toggleButton.setAttribute("data-fixed-lock", "");
    }
    this.#toggleButton.setAttribute("aria-label", "Dark Mode Toggle Button");

    this.#toggleButton.addEventListener("mousedown", (e) => e.preventDefault());

    this.#input = document.createElement("input");
    this.#input.type = "checkbox";
    this.#input.setAttribute("aria-label", "Enable dark mode");
    this.#input.setAttribute("role", "switch");

    const track = document.createElement("div");
    track.classList.add("dark-mode-toggler-track");

    const thumb = document.createElement("div");
    thumb.classList.add("dark-mode-toggler-thumb");

    thumb.innerHTML = `
    <span class="dark-mode-toggler-sun" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2"  x2="12" y2="6"/>
        <line x1="12" y1="18" x2="12" y2="22"/>
        <line x1="2"  y1="12" x2="6"  y2="12"/>
        <line x1="18" y1="12" x2="22" y2="12"/>
        <line x1="4.22" y1="4.22"   x2="7.05" y2="7.05"/>
        <line x1="16.95" y1="16.95" x2="19.78" y2="19.78"/>
        <line x1="4.22" y1="19.78"  x2="7.05" y2="16.95"/>
        <line x1="16.95" y1="7.05"  x2="19.78" y2="4.22"/>
      </svg>
    </span>
    <span class="dark-mode-toggler-moon" aria-hidden="true">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </span>
  `;

    track.appendChild(thumb);
    this.#toggleButton.appendChild(this.#input);
    this.#toggleButton.appendChild(track);
    this.#container.appendChild(this.#toggleButton);
  }

  /** Restore the saved choice, falling back to the system preference. */
  #loadMode() {
    const savedMode = this.#readPreference();
    if (savedMode === "enabled") this.#applyMode(true);
    else if (savedMode === "disabled") this.#applyMode(false);
    else if (savedMode === null) {
      this.#applyMode(
        window.matchMedia("(prefers-color-scheme: dark)").matches,
      );
    }
  }

  #applyMode(isDark) {
    if (isDark) this.#root.setAttribute("data-hygular-theme", "dark");
    else this.#root.removeAttribute("data-hygular-theme");
    if (this.#input) this.#input.checked = isDark;
    this.#customBtn?.classList.toggle("is-dark", isDark);
  }

  #notifyChange() {
    const isDark = this.isDark();
    this.#onChangeCallbacks.forEach((callback) => callback(isDark));
    this.#root.dispatchEvent(
      new CustomEvent("hygular.theme.change", { detail: { isDark } }),
    );
  }

  /** Read a saved preference when browser storage is available. */
  #readPreference() {
    try {
      return localStorage.getItem(this.#storageKey);
    } catch {
      return null;
    }
  }

  /** Keep theme switching available when storage is blocked. */
  #savePreference(value) {
    try {
      localStorage.setItem(this.#storageKey, value);
    } catch {
      // The active theme does not depend on persistent storage.
    }
  }

  /** Toggle the theme, persist the choice, and notify listeners. */
  #toggleMode() {
    const isDark = !this.isDark();
    this.#applyMode(isDark);
    this.#savePreference(isDark ? "enabled" : "disabled");
    this.#notifyChange();
  }

  /**
   * Bind the generated switch or the configured custom button.
   */
  #bindEvents() {
    if (this.#input) {
      this.#input.addEventListener("change", () => this.#toggleMode());
    }

    if (this.#config.customBtn) {
      this.#customBtn = document.querySelector(this.#config.customBtn);
      if (!this.#customBtn) return;
      this.#customBtnListener = () => this.#toggleMode();
      this.#customBtn.addEventListener("click", this.#customBtnListener);
    }
  }

  /**
   * Initialize controls and follow system changes until a theme preference is
   * stored.
   */
  #init() {
    if (this.#config.autoCreateBtn && !this.#config.customBtn) {
      this.#createButton();
    }
    this.#bindEvents();
    this.#loadMode();
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.#mediaQuery = mediaQuery;
      this.#mediaQueryListener = (event) => {
        if (this.#readPreference() !== null) return;
        this.#applyMode(event.matches);
        this.#notifyChange();
      };
      mediaQuery.addEventListener("change", this.#mediaQueryListener);
    }
  }

  /**
   * Return whether the root element currently uses the dark theme.
   */
  isDark() {
    return this.#root?.getAttribute("data-hygular-theme") === "dark";
  }

  /**
   * Register a callback for subsequent theme changes.
   */
  onChange(callback) {
    if (typeof callback === "function") {
      this.#onChangeCallbacks.push(callback);
    }
  }

  /**
   * Remove the generated switch and detach custom-button and system-preference
   * listeners.
   */
  dispose() {
    this.#toggleButton?.remove();
    this.#toggleButton = null;
    this.#input = null;

    if (this.#mediaQueryListener) {
      this.#mediaQuery?.removeEventListener("change", this.#mediaQueryListener);
    }
    if (this.#customBtn && this.#customBtnListener) {
      this.#customBtn.removeEventListener("click", this.#customBtnListener);
    }
    this.#onChangeCallbacks = [];
    this.#customBtn = null;
    this.#customBtnListener = null;
    this.#mediaQueryListener = null;
    this.#mediaQuery = null;
  }
}
