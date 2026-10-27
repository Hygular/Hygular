/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect, useRef } from "react";
import Select from "../js/components/Select.js";

/**
 * Initialize a select on mount, forward change events, and dispose it on unmount.
 */
export function useSelect(target, options = {}) {
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!target) return;

    const { onChange, ...selectOptions } = options;
    const el = target?.current ?? target;

    const instance = new Select(el, selectOptions);
    instanceRef.current = instance;

    const selectEl = typeof el === "string" ? document.querySelector(el) : el;

    const handleChange = (event) => {
      onChange?.(event.target.value);
    };

    selectEl?.addEventListener("change", handleChange);

    return () => {
      selectEl?.removeEventListener("change", handleChange);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return { instance: instanceRef };
}
