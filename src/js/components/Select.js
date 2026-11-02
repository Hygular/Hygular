/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import Debug from "../core/Debug.js";

export default class Select {
  #el;
  #config;
  #data;
  #selected = [];
  #root;
  #display;
  #list;
  #hidden;
  #searchInput;
  #onDocClick;
  #duration;
  #handleDisplayClick;
  #handleSearchInput;
  #resizeObserver;
  #closeTimer = null;
  #options;
  #optionElements = [];
  #activeIndex = -1;
  #isOpen = false;
  #isDisposed = false;
  #layoutFrame = null;
  #handleKeydown;
  #handleFocusout;
  static #count = 0;

  // Default options
  static defaults = {
    inputName: "select",
    multiple: false,
    defaultValue: null,
    data: [],
    search: false,
    placeholder: "--SELECT--",
  };

  // Transition settings
  static variables = {
    animationDuration: 200, // ms
  };

  /**
   * Build a custom select beside the target using the supplied option data.
   */
  constructor(selector, options = {}) {
    // Skip DOM setup outside the browser.
    if (typeof window === "undefined" || typeof document === "undefined")
      return;
    this.#el =
      selector instanceof Element ? selector : document.querySelector(selector);

    if (!(this.#el instanceof Element)) {
      Debug.warn(`[Select] Target element was not found.`);
      return;
    }

    this.#config = {
      ...Select.defaults,
      ...options,
      data: options.data ?? Select.defaults.data,
    };
    this.#data = this.#config.data;
    this.#duration = Select.variables.animationDuration;
    this.#init();
  }

  /**
   * Build the control, bind outside-click handling, and apply configured defaults.
   */
  #init() {
    this.#build();
    this.#bindDocumentClose();
    if (this.#config.defaultValue != null) this.#applyDefault();
  }

  /**
   * Build the display, option list, hidden input, and optional search field.
   */
  #build() {
    this.#root = document.createElement("div");
    this.#root.className = "custom-select";

    this.#root.setAttribute("aria-expanded", "false");
    this.#root.setAttribute("aria-haspopup", "listbox");

    this.#display = document.createElement("div");
    this.#display.className = "selected-option";
    this.#display.tabIndex = 0;
    this.#display.setAttribute("role", "combobox");
    this.#display.setAttribute("aria-expanded", "false");
    this.#display.setAttribute("aria-haspopup", "listbox");
    const labelId = this.#el.getAttribute("aria-labelledby");
    const label =
      this.#el.getAttribute("aria-label") ||
      Array.from(this.#el.labels || [])
        .map((item) => item.textContent.trim())
        .join(" ");
    if (labelId) this.#display.setAttribute("aria-labelledby", labelId);
    else
      this.#display.setAttribute(
        "aria-label",
        label || this.#config.placeholder,
      );
    this.#display.innerText = this.#config.placeholder;
    this.#root.appendChild(this.#display);

    this.#list = document.createElement("div");
    this.#list.className = "options-container";
    this.#list.style.transition = `opacity ${this.#duration}ms ease, transform ${this.#duration}ms ease`;
    this.#list.hidden = true;
    this.#root.appendChild(this.#list);

    this.#hidden = document.createElement("input");
    this.#hidden.type = "hidden";
    this.#hidden.name = this.#config.inputName;
    this.#root.appendChild(this.#hidden);

    if (this.#config.search) {
      this.#searchInput = document.createElement("input");
      this.#searchInput.type = "text";
      this.#searchInput.placeholder = "Search...";
      this.#searchInput.className = "form-input";
      this.#handleSearchInput = () => this.#filterOptions();
      this.#searchInput.addEventListener("input", this.#handleSearchInput);
      this.#list.appendChild(this.#searchInput);
    }

    this.#options = document.createElement("div");
    this.#options.id = `hygular-select-${++Select.#count}`;
    this.#options.setAttribute("role", "listbox");
    this.#options.setAttribute("aria-label", label || this.#config.placeholder);
    if (this.#config.multiple)
      this.#options.setAttribute("aria-multiselectable", "true");
    this.#list.appendChild(this.#options);
    this.#display.setAttribute("aria-controls", this.#options.id);
    if (this.#searchInput) {
      this.#searchInput.setAttribute("role", "combobox");
      this.#searchInput.setAttribute(
        "aria-label",
        label ? `Search ${label}` : "Search options",
      );
      this.#searchInput.setAttribute("aria-autocomplete", "list");
      this.#searchInput.setAttribute("aria-controls", this.#options.id);
      this.#searchInput.setAttribute("aria-expanded", "false");
    }
    this.#data.forEach((opt) => this.#addOption(opt));
    this.#handleDisplayClick = () => {
      this.toggle();
      if (this.#isOpen) this.#searchInput?.focus();
    };
    this.#display.addEventListener("click", this.#handleDisplayClick);
    this.#handleKeydown = (event) => this.#onKeydown(event);
    this.#handleFocusout = (event) => {
      if (!this.#root.contains(event.relatedTarget)) this.close();
    };
    this.#root.addEventListener("keydown", this.#handleKeydown);
    this.#root.addEventListener("focusout", this.#handleFocusout);
    this.#el.insertAdjacentElement("afterend", this.#root);
    if (this.#config.multiple && typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver(() => this.#scheduleLayout());
      this.#resizeObserver.observe(this.#display);
    }
  }

  /**
   * Append an option and bind its selection handler.
   */
  #addOption(opt) {
    const div = document.createElement("div");
    div.setAttribute("role", "option");
    div.className = "select-option";
    div.id = `${this.#options.id}-option-${this.#optionElements.length}`;
    div.setAttribute("aria-selected", "false");
    this.#optionElements.push(div);
    div.dataset.value = opt.value;
    div.dataset.name = opt.name.toLowerCase();
    if (opt.icon) {
      const img = document.createElement("img");
      img.src = opt.icon;
      img.className = "option-icon";
      div.appendChild(img);
    }
    const textNode = document.createTextNode(opt.name);
    div.appendChild(textNode);
    div.addEventListener("click", () => {
      this.select(opt);
      if (!this.#isDisposed)
        (this.#isOpen && this.#searchInput
          ? this.#searchInput
          : this.#display
        ).focus();
    });
    this.#options.appendChild(div);
  }

  /**
   * Update the selection and underlying values, then dispatch a change event on
   * the target.
   */
  select(opt) {
    if (this.#isDisposed || !this.#root || !opt) return;
    if (this.#config.multiple) {
      if (this.#selected.find((s) => s.value === opt.value)) return;
      this.#selected.push(opt);
      this.#renderMultiSelected();
    } else {
      this.#selected = [opt];
      this.#display.innerHTML = "";
      if (opt.icon) {
        const img = document.createElement("img");
        img.src = opt.icon;
        img.className = "option-icon";
        this.#display.appendChild(img);
      }
      this.#display.appendChild(document.createTextNode(opt.name));

      this.close();
    }

    this.#commitSelection();
  }

  /**
   * Render selected tags and collapse overflow into a summary count.
   */
  #renderMultiSelected() {
    this.#display.innerHTML = "";
    if (!this.#config.multiple || this.#selected.length === 0) {
      this.#display.innerText = this.#config.placeholder;
      return;
    }
    this.#selected.forEach((opt) => {
      const d = document.createElement("div");
      d.className = "select-tag";

      if (opt.icon) {
        const img = document.createElement("img");
        img.src = opt.icon;
        img.className = "option-icon";
        d.appendChild(img);
      }

      d.appendChild(document.createTextNode(opt.name));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.setAttribute("aria-label", `Remove ${opt.name}`);
      removeBtn.className = "tag-remove";
      removeBtn.textContent = "×";
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        this.remove(opt.value);
        if (!this.#isDisposed) this.#display.focus();
      };
      d.appendChild(removeBtn);

      this.#display.appendChild(d);
    });
    this.#scheduleLayout();
  }

  /** Measure current tags on the next frame and summarize overflow. */
  #scheduleLayout() {
    if (this.#isDisposed || this.#layoutFrame !== null) return;
    this.#layoutFrame = requestAnimationFrame(() => {
      this.#layoutFrame = null;
      if (this.#isDisposed) return;
      const width = this.#display.getBoundingClientRect().width;
      if (width <= 0) return;
      let used = 0;
      let hidden = 0;
      this.#display.querySelectorAll(".select-tag").forEach((tag) => {
        tag.style.display = "inline-flex";
        const size = tag.offsetWidth + 6;
        if (used + size > width - 55) {
          tag.style.display = "none";
          hidden++;
        } else used += size;
      });
      this.#display.querySelector(".more-tag")?.remove();
      if (hidden) {
        const summary = document.createElement("div");
        summary.className = "more-tag";
        summary.textContent = `+${hidden} more`;
        this.#display.appendChild(summary);
      }
    });
  }

  /** Sync option states and input values, then notify the target of the change. */
  #commitSelection() {
    this.#syncSelection();
    this.#hidden.value = this.#selected.map((item) => item.value).join(",");
    this.#el.value = this.#hidden.value;
    this.#el.dispatchEvent(new Event("change"));
  }

  /** Update option accessibility states from the selected values. */
  #syncSelection() {
    this.#optionElements.forEach((option, index) => {
      const selected = this.#selected.some(
        (item) => item.value === this.#data[index].value,
      );
      option.setAttribute("aria-selected", String(selected));
    });
  }

  /** Update the keyboard highlight and active-descendant references. */
  #setActive(index) {
    this.#activeIndex = index;
    this.#optionElements.forEach((option, i) =>
      option.classList.toggle("is-active", i === index),
    );
    const active = this.#optionElements[index];
    for (const control of [this.#display, this.#searchInput]) {
      if (!control) continue;
      if (active) control.setAttribute("aria-activedescendant", active.id);
      else control.removeAttribute("aria-activedescendant");
    }
    active?.scrollIntoView?.({ block: "nearest" });
  }

  /** Handle list navigation, selection, and keyboard dismissal. */
  #onKeydown(event) {
    if (
      this.#isDisposed ||
      event.target.closest(".tag-remove") ||
      event.isComposing
    )
      return;
    const searching = event.target === this.#searchInput;
    if (event.key === "Tab") {
      this.close();
      return;
    }
    if (event.key === "Escape") {
      if (this.#isOpen) {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        this.#display.focus();
      }
      return;
    }
    const arrow = event.key === "ArrowDown" || event.key === "ArrowUp";
    const boundary =
      !searching && (event.key === "Home" || event.key === "End");
    if (arrow || boundary) {
      event.preventDefault();
      const wasOpen = this.#isOpen;
      this.open();
      const visible = this.#optionElements
        .map((el, i) => (el.hidden ? -1 : i))
        .filter((i) => i >= 0);
      let position = visible.indexOf(this.#activeIndex);
      if (event.key === "Home") position = 0;
      else if (event.key === "End") position = visible.length - 1;
      else if (wasOpen)
        position =
          position < 0
            ? event.key === "ArrowUp"
              ? visible.length - 1
              : 0
            : Math.max(
                0,
                Math.min(
                  visible.length - 1,
                  position + (event.key === "ArrowUp" ? -1 : 1),
                ),
              );
      else if (event.key === "ArrowUp") position = visible.length - 1;
      this.#setActive(visible[position] ?? -1);
      return;
    }
    if (event.key === "Enter" || (event.key === " " && !searching)) {
      event.preventDefault();
      if (!this.#isOpen) {
        this.open();
        this.#searchInput?.focus();
      } else if (this.#activeIndex >= 0) {
        const option = this.#data[this.#activeIndex];
        if (
          this.#config.multiple &&
          this.#selected.some((item) => item.value === option.value)
        )
          this.remove(option.value);
        else this.select(option);
        if (!this.#isDisposed && !this.#isOpen) this.#display.focus();
      }
    }
  }

  /**
   * Remove a selected value and notify the target of the change.
   */
  remove(value) {
    if (this.#isDisposed || !this.#root) return;
    this.#selected = this.#selected.filter((s) => s.value !== value);
    this.#renderMultiSelected();
    this.#syncSelection();
    this.#hidden.value = this.#selected.map((e) => e.value).join(",");
    this.#el.value = this.#hidden.value;
    this.#el.dispatchEvent(new Event("change"));
  }

  /**
   * Select the configured defaults that exist in the option data.
   */
  #applyDefault() {
    const def = Array.isArray(this.#config.defaultValue)
      ? this.#config.defaultValue.map((v) =>
          this.#data.find((o) => o.value == v),
        )
      : [this.#data.find((o) => o.value == this.#config.defaultValue)];

    def.forEach((o) => o && this.select(o));
  }

  /**
   * Display the option panel and mark the control as expanded.
   */
  open() {
    if (this.#isDisposed || !this.#root || this.#isOpen) return;
    this.#isOpen = true;
    this.#list.hidden = false;
    this.#display.setAttribute("aria-expanded", "true");
    this.#searchInput?.setAttribute("aria-expanded", "true");
    this.#setActive(
      this.#optionElements.findIndex(
        (option) =>
          !option.hidden && option.getAttribute("aria-selected") === "true",
      ),
    );
    if (this.#activeIndex < 0)
      this.#setActive(
        this.#optionElements.findIndex((option) => !option.hidden),
      );
    clearTimeout(this.#closeTimer);
    this.#closeTimer = null;
    this.#list.style.display = "block";
    void this.#list.offsetWidth;
    this.#list.style.opacity = "1";
    this.#list.style.transform = "translateX(-50%) translateY(0)";
    this.#root.setAttribute("aria-expanded", "true");
  }

  /**
   * Start the closing transition and hide the panel after the configured delay.
   */
  close() {
    if (this.#isDisposed || !this.#root || !this.#isOpen) return;
    this.#isOpen = false;
    this.#display.setAttribute("aria-expanded", "false");
    this.#searchInput?.setAttribute("aria-expanded", "false");
    this.#setActive(-1);
    clearTimeout(this.#closeTimer);
    this.#list.style.opacity = "0";
    this.#list.style.transform = "translateX(-50%) translateY(-8px)";
    this.#root.setAttribute("aria-expanded", "false");
    this.#closeTimer = setTimeout(() => {
      this.#list.style.display = "none";
      this.#list.hidden = true;
      this.#closeTimer = null;
    }, this.#duration);
  }

  /**
   * Toggle the option panel based on its current display state.
   */
  toggle() {
    if (this.#isOpen) this.close();
    else this.open();
  }

  /**
   * Filter option labels using a case-insensitive substring match.
   */
  #filterOptions() {
    const query = this.#searchInput.value.toLowerCase();
    this.#list.querySelectorAll(".select-option").forEach((opt) => {
      const txt = opt.dataset.name;
      opt.hidden = !txt.includes(query);
      opt.style.display = opt.hidden ? "none" : "flex";
    });
    this.#setActive(this.#optionElements.findIndex((option) => !option.hidden));
  }

  /**
   * Close the panel when a click occurs outside the generated control.
   */
  #bindDocumentClose() {
    this.#onDocClick = (e) => {
      if (!this.#root.contains(e.target)) this.close();
    };
    document.addEventListener("click", this.#onDocClick);
  }

  /**
   * Detach handlers, remove the generated control, and disconnect its resize
   * observer.
   */
  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    if (this.#layoutFrame !== null) cancelAnimationFrame(this.#layoutFrame);
    this.#layoutFrame = null;
    this.#root?.removeEventListener("keydown", this.#handleKeydown);
    this.#root?.removeEventListener("focusout", this.#handleFocusout);
    clearTimeout(this.#closeTimer);
    this.#closeTimer = null;
    this.#root?.ownerDocument.removeEventListener("click", this.#onDocClick);
    this.#display?.removeEventListener("click", this.#handleDisplayClick);
    if (this.#searchInput && this.#handleSearchInput) {
      this.#searchInput.removeEventListener("input", this.#handleSearchInput);
    }
    this.#root?.remove();
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
  }
}
