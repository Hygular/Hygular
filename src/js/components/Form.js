/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import DelegateRegistry from "../utils/DelegateRegistry.js";

export default class Form {
  /**
   * Built-in validators. Each returns true on success or an error message.
   */
  static #rules = {
    email: (val) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val) ||
      "Please enter a valid email address.",

    phone: (val) =>
      /^\+?[1-9]\d{1,14}$/.test(val.replace(/[\s\-()]/g, "")) ||
      "Please enter a valid phone number.",

    number: (val) =>
      /^-?\d+(\.\d+)?$/.test(val) || "This field must be a valid number.",

    integer: (val) => /^-?\d+$/.test(val) || "This field must be an integer.",

    alphanumeric: (val) =>
      /^[a-zA-Z0-9]+$/.test(val) || "Only letters and numbers are allowed.",

    url: (val) =>
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(val) ||
      "Please enter a valid URL.",

    "password-strength": (val) =>
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]{8,}$/.test(val) ||
      "Password must be 8+ chars, include uppercase, lowercase, and a number.",

    "no-spaces": (val) => !/\s/.test(val) || "Spaces are not allowed.",

    min: (val, param) => {
      const n = Number(param);
      if (isNaN(n)) return `Invalid min param: "${param}".`;
      const isNumeric = /^-?\d+(\.\d+)?$/.test(val.trim());
      if (isNumeric)
        return Number(val) >= n ? true : `Value must be at least ${n}.`;
      return val.length >= n ? true : `Must be at least ${n} characters.`;
    },

    max: (val, param) => {
      const n = Number(param);
      if (isNaN(n)) return `Invalid max param: "${param}".`;
      const isNumeric = /^-?\d+(\.\d+)?$/.test(val.trim());
      if (isNumeric)
        return Number(val) <= n ? true : `Value must be no more than ${n}.`;
      return val.length <= n ? true : `Must be no more than ${n} characters.`;
    },

    minlen: (val, param) => {
      const n = Number(param);
      if (isNaN(n)) return `Invalid minlen param: "${param}".`;
      return val.length >= n ? true : `Must be at least ${n} characters.`;
    },

    maxlen: (val, param) => {
      const n = Number(param);
      if (isNaN(n)) return `Invalid maxlen param: "${param}".`;
      return val.length <= n ? true : `Must be no more than ${n} characters.`;
    },

    minval: (val, param) => {
      const n = Number(param);
      if (isNaN(n)) return `Invalid minval param: "${param}".`;
      return Number(val) >= n ? true : `Value must be at least ${n}.`;
    },

    maxval: (val, param) => {
      const n = Number(param);
      if (isNaN(n)) return `Invalid maxval param: "${param}".`;
      return Number(val) <= n ? true : `Value must be no more than ${n}.`;
    },

    exact: (val, param) => {
      const n = Number(param);
      if (isNaN(n)) return `Invalid exact param: "${param}".`;
      return val.length === n ? true : `Must be exactly ${n} characters.`;
    },

    match: (val, param) => {
      if (!param)
        return "match rule requires a selector param, e.g. match:#other-id";
      const other = document.querySelector(param);
      if (!other) {
        console.warn(
          `Hygular [match]: No element found for selector "${param}"`,
        );
        return `match rule: target "${param}" not found.`;
      }
      return val === other.value ? true : "Fields do not match.";
    },

    contains: (val, param) =>
      val.includes(param) ? true : `Must contain "${param}".`,
    startswith: (val, param) =>
      val.startsWith(param) ? true : `Must start with "${param}".`,
    endswith: (val, param) =>
      val.endsWith(param) ? true : `Must end with "${param}".`,
    "file-max": (val, param, field) => {
      if (field.type !== "file" || !field.files || field.files.length === 0)
        return true;
      const maxSize = Number(param) * 1024 * 1024;
      const overSized = Array.from(field.files).find((f) => f.size > maxSize);
      return !overSized ? true : `File size cannot exceed ${param}MB.`;
    },
    "file-ext": (val, param, field) => {
      if (field.type !== "file" || !field.files || field.files.length === 0)
        return true;
      const exts = param.split(",").map((e) => e.trim().toLowerCase());
      const invalidFile = Array.from(field.files).find((f) => {
        const extMatch = f.name.match(/\.([a-z0-9]+)$/i);
        return !exts.includes(extMatch ? extMatch[1].toLowerCase() : "");
      });
      return !invalidFile ? true : `Allowed file types: ${exts.join(", ")}`;
    },
  };

  /**
   * Register a validator, warning when an existing rule is replaced.
   */
  static addRule(name, fn) {
    if (typeof name !== "string" || !name.trim()) {
      console.warn("Hygular [addRule]: Rule name must be a non-empty string.");
      return;
    }
    if (typeof fn !== "function") {
      console.warn(`Hygular [addRule]: Rule "${name}" must be a function.`);
      return;
    }
    if (Form.#rules[name]) {
      console.warn(
        `Hygular [addRule]: Rule "${name}" already exists — overwriting.`,
      );
    }
    Form.#rules[name] = fn;
  }

  /**
   * Bind delegated validation and submission handlers. Return a function that
   * detaches the listeners.
   */
  static init() {
    return DelegateRegistry.subscribe("form", Form.#bind);
  }

  static #bind(document) {
    const CONFIG = {
      selector: '[data-hygular="form"]',

      selectors: {
        groupFile: ".group-file",
        inputFile: ".form-file",
        uploadDisplay: ".upload-display",
      },

      classes: {
        validated: "is-validated",
        loading: "is-loading",
      },

      defaults: {
        ajaxTimeout: 30000, // Default request timeout in milliseconds.
      },
    };

    const runDataRules = (field) => {
      const raw = field.getAttribute("data-rule");
      if (!raw) return null;
      if (!field.value && field.type !== "file") return null;

      for (const token of raw.trim().split(/\s+/)) {
        const colonIdx = token.indexOf(":");
        const ruleName = colonIdx === -1 ? token : token.slice(0, colonIdx);
        const param = colonIdx === -1 ? undefined : token.slice(colonIdx + 1);

        const rule = Form.#rules[ruleName];
        if (!rule) {
          console.warn(`Hygular: Unknown rule "${ruleName}"`);
          continue;
        }

        const result = rule(field.value, param, field);
        if (result !== true) return String(result); // Stop at the first failing rule.
      }

      return null;
    };

    const SKIP_TYPES = new Set([
      "hidden",
      "submit",
      "button",
      "reset",
      "image",
    ]);

    const getOrGenerateFeedbackEl = (field) => {
      if (SKIP_TYPES.has(field.type)) return null;

      if (field.hasAttribute("data-no-feedback")) return null;
      const atom = field.closest(
        ".group-checkbox, .group-radio, .group-switch",
      );
      const parent = atom?.closest(".group") || atom || field.parentNode;

      let el = parent.querySelector(":scope > .form-feedback.is-invalid");
      if (!el) {
        el = document.createElement("div");
        el.className = "form-feedback is-invalid";
        parent.appendChild(el);
      }
      return el;
    };

    const clearServerFeedback = (form) => {
      form.querySelectorAll(".form-feedback.is-server").forEach((el) => {
        el.classList.remove("is-server", "with-success", "with-error");
        el.textContent = "";
      });
    };

    /**
     * Apply server field errors from an { errors: { name: message } } response.
     */
    const populateServerFeedback = (form, data) => {
      const errors = data?.errors;
      if (!errors || typeof errors !== "object") return;

      Object.entries(errors).forEach(([name, msg]) => {
        const field = form.querySelector(`[name="${CSS.escape(name)}"]`);
        if (!field) return;

        const message = Array.isArray(msg) ? msg[0] : msg;
        if (!message) return;

        field.setCustomValidity(String(message));

        const el = getOrGenerateFeedbackEl(field);
        if (el) {
          el.textContent = String(message);
          el.classList.add("form-feedback", "is-server", "with-error");
        }
      });

      form.querySelector(":invalid")?.focus();
    };

    /**
     * Use checked state for checkboxes and radio groups; their value alone does not
     * indicate selection.
     */
    const isFieldEmpty = (field) => {
      if (field.type === "checkbox") return !field.checked;

      if (field.type === "radio") {
        const root = field.form || document;
        const group = root.querySelectorAll(
          `input[type="radio"][name="${CSS.escape(field.name)}"]`,
        );
        return !Array.from(group).some((radio) => radio.checked);
      }

      if (field.type === "file") return field.files.length === 0;
      return !field.value;
    };

    const validateField = (field) => {
      if (SKIP_TYPES.has(field.type)) return;

      // Clear the previous custom error before checking the current value.
      field.setCustomValidity("");
      if (isFieldEmpty(field)) {
        if (field.required) {
          const msg =
            field.getAttribute("data-required-msg") ||
            "This field is required.";
          field.setCustomValidity(msg);
          const el = getOrGenerateFeedbackEl(field);
          if (el) el.textContent = msg;
        }
        return;
      }

      let errorMsg = null;

      // Run named validation rules before the custom pattern.
      errorMsg = runDataRules(field);

      // Check the custom pattern only if the named rules passed.
      if (!errorMsg) {
        const pattern = field.getAttribute("data-regex");
        if (pattern) {
          try {
            if (!new RegExp(pattern).test(field.value)) {
              errorMsg =
                field.getAttribute("data-error-msg") || "Format is invalid.";
            }
          } catch {
            console.error(`Hygular: Invalid regex pattern: ${pattern}`);
          }
        }
      }

      if (errorMsg) field.setCustomValidity(errorMsg);

      if (!field.validity.valid) {
        const el = getOrGenerateFeedbackEl(field);
        if (el) {
          el.textContent =
            field.getAttribute("data-error-msg") ||
            errorMsg ||
            field.validationMessage;
        }
      }
    };

    // Track touched fields so input validation starts after the first blur or submit.
    const touchedFields = new WeakSet();
    const requests = new Map();
    let disposed = false;

    const releaseRequest = (form, request, abort = false) => {
      if (requests.get(form) !== request) return;
      requests.delete(form);
      clearTimeout(request.timeoutId);
      const button = request.submitBtn;
      if (button) {
        button.classList.toggle(CONFIG.classes.loading, request.wasLoading);
        button.disabled = request.wasDisabled;
      }
      if (!requests.size) removalObserver.disconnect();
      if (abort) request.controller.abort();
    };
    const removalObserver = new document.defaultView.MutationObserver(() => {
      requests.forEach((request, form) => {
        if (!document.contains(form)) releaseRequest(form, request, true);
      });
    });

    // AJAX submission
    const handleAjaxSubmit = async (form, submitBtn) => {
      if (disposed || requests.has(form) || !document.contains(form)) return;

      const method = (form.getAttribute("method") || "POST").toUpperCase();

      // Read optional request headers from the form attributes.
      let customHeaders = {};
      const headersAttr = form.getAttribute("data-ajax-headers");
      if (headersAttr) {
        try {
          customHeaders = JSON.parse(headersAttr);
        } catch {
          console.warn(
            "Hygular: Invalid JSON in data-ajax-headers — ignoring.",
            form,
          );
        }
      }

      // Use the form timeout override, falling back to the default.
      const timeoutMs =
        Number(form.getAttribute("data-ajax-timeout")) ||
        CONFIG.defaults.ajaxTimeout;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const request = {
        controller,
        timeoutId,
        submitBtn,
        wasDisabled: submitBtn?.disabled ?? false,
        wasLoading:
          submitBtn?.classList.contains(CONFIG.classes.loading) ?? false,
      };
      requests.set(form, request);
      submitBtn?.classList.add(CONFIG.classes.loading);
      if (submitBtn) submitBtn.disabled = true;
      removalObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      const isCurrent = () =>
        !disposed && requests.get(form) === request && document.contains(form);

      try {
        const startEvent = new CustomEvent("hygular.form.start", {
          detail: { form },
          cancelable: true,
        });
        form.dispatchEvent(startEvent);
        if (startEvent.defaultPrevented || !isCurrent()) return;
        const formData = new document.defaultView.FormData(form);
        const url = new URL(form.action || document.defaultView.location.href);
        const hasBody = method !== "GET" && method !== "HEAD";
        if (!hasBody) {
          for (const [name, value] of formData)
            url.searchParams.append(
              name,
              typeof value === "string" ? value : value.name,
            );
        }
        const response = await fetch(url.href, {
          method,
          ...(hasBody ? { body: formData } : {}),
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/json",
            ...customHeaders,
          },
          signal: controller.signal,
        });

        const data = await response.json().catch(() => null);
        if (!isCurrent()) return;
        if (controller.signal.aborted) {
          throw new document.defaultView.DOMException(
            "Request timed out",
            "AbortError",
          );
        }

        if (response.ok) {
          clearServerFeedback(form);
          form.reset();
          if (!isCurrent()) return;
          form
            .querySelectorAll(".group.floating-label select")
            .forEach(updateSelectLabel);
          form.classList.remove(CONFIG.classes.validated);
          // Treat fields as untouched after a successful reset.
          form.querySelectorAll("input, select, textarea").forEach((f) => {
            touchedFields.delete(f);
          });
          form.dispatchEvent(
            new CustomEvent("hygular.form.success", {
              bubbles: true,
              detail: { response, data },
            }),
          );
        } else {
          populateServerFeedback(form, data);
          form.dispatchEvent(
            new CustomEvent("hygular.form.error", {
              detail: { response, data },
            }),
          );
        }
      } catch (error) {
        if (!isCurrent()) return;
        const aborted = error.name === "AbortError";
        console.error(
          aborted
            ? "Hygular AJAX Form Error: request timed out."
            : "Hygular AJAX Form Error:",
          aborted ? "" : error,
        );
        form.dispatchEvent(
          new CustomEvent("hygular.form.error", {
            detail: { error, timeout: aborted },
          }),
        );
      } finally {
        releaseRequest(form, request);
      }
    };

    // Delegated event handlers
    const submitHandler = (evt) => {
      if (disposed) return;
      const form = evt.target.closest(CONFIG.selector);
      if (!form) return;

      // Clear server feedback before validating the current field values.
      clearServerFeedback(form);

      form.classList.add(CONFIG.classes.validated);
      form.querySelectorAll("input, select, textarea").forEach((f) => {
        touchedFields.add(f);
        validateField(f);
      });

      if (!form.checkValidity()) {
        evt.preventDefault();
        evt.stopPropagation();
        form.querySelector(":invalid")?.focus();
        return;
      }

      if (!evt.defaultPrevented && form.getAttribute("data-ajax") === "true") {
        evt.preventDefault();
        handleAjaxSubmit(form, evt.submitter);
      }
    };

    // Mark the field as touched and validate on blur.
    const blurHandler = (evt) => {
      const field = evt.target;
      if (!field.matches("input, select, textarea")) return;
      if (!field.closest(CONFIG.selector)) return;

      touchedFields.add(field);
      validateField(field);
    };

    // Revalidate touched fields as their values change.
    const inputHandler = (evt) => {
      const target = evt.target;
      if (!target.matches("input, select, textarea")) return;
      const form = target.closest(CONFIG.selector);
      if (!form) return;

      if (touchedFields.has(target)) validateField(target);

      // A match error must clear before native validation can block submission.
      form
        .querySelectorAll(
          "input[data-rule], select[data-rule], textarea[data-rule]",
        )
        .forEach((field) => {
          if (field === target || !touchedFields.has(field)) return;
          const dependsOnTarget = field
            .getAttribute("data-rule")
            .trim()
            .split(/\s+/)
            .some((rule) => {
              if (!rule.startsWith("match:")) return false;
              try {
                return document.querySelector(rule.slice(6)) === target;
              } catch {
                return false;
              }
            });
          if (dependsOnTarget) validateField(field);
        });
    };

    const changeHandler = (evt) => {
      inputHandler(evt);
      const input = evt.target;
      if (!input.matches(CONFIG.selectors.inputFile)) return;

      const group = input.closest(CONFIG.selectors.groupFile);
      if (!group) return;

      const display = group.querySelector(CONFIG.selectors.uploadDisplay);

      if (display) {
        if (input.files.length === 0) {
          display.textContent =
            group.getAttribute("data-default-text") || "No file selected";
        } else if (input.files.length === 1) {
          display.textContent = `Selected: ${input.files[0].name.replace(/[<>/\\|:*?"']/g, "_")}`;
        } else {
          display.textContent = `${input.files.length} items selected`;
        }
      }

      touchedFields.add(input);
      validateField(input);
    };

    const updateSelectLabel = (select) => {
      let label = select.nextElementSibling;
      if (!label?.classList.contains("select-label")) {
        label = document.createElement("label");
        label.className = "select-label";
        label.textContent =
          select.options[0]?.textContent || "Select an option";
        select.insertAdjacentElement("afterend", label);
      }
      const visible = select.value !== "";
      label.classList.toggle("floating-label-visible", visible);
      label.classList.toggle("floating-label-hidden", !visible);
    };
    const labelHandler = (event) => {
      if (event.target.matches(".group.floating-label select"))
        updateSelectLabel(event.target);
    };

    // Initialize new markup without adding element-level listeners.
    const initVisuals = () => {
      document
        .querySelectorAll(".group.floating-label select")
        .forEach(updateSelectLabel);

      // Create feedback containers for fields already in the document.
      document
        .querySelectorAll(
          `${CONFIG.selector} input, ${CONFIG.selector} select, ${CONFIG.selector} textarea`,
        )
        .forEach(getOrGenerateFeedbackEl);
    };

    // Attach delegated listeners.
    document.addEventListener("submit", submitHandler);
    document.addEventListener("change", changeHandler);
    document.addEventListener("change", labelHandler, true);
    document.addEventListener("input", inputHandler);
    document.addEventListener("blur", blurHandler, true);
    return {
      refresh: initVisuals,
      dispose() {
        disposed = true;
        document.removeEventListener("submit", submitHandler);
        document.removeEventListener("change", changeHandler);
        document.removeEventListener("change", labelHandler, true);
        document.removeEventListener("input", inputHandler);
        document.removeEventListener("blur", blurHandler, true);
        removalObserver.disconnect();
        requests.forEach((request, form) =>
          releaseRequest(form, request, true),
        );
      },
    };
  }
}
