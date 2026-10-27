/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect, useRef, useCallback, useState } from "react";
import Range from "../js/components/Range.js";

/**
 * Bind range inputs to React state and expose value and refresh controls.
 */
export function useRange(options = {}) {
  const { onInput, onChange, ...rangeOptions } = options;

  const elementRef = useRef(null);
  const instanceRef = useRef(null);
  const callbacksRef = useRef({ onInput, onChange });
  callbacksRef.current = { onInput, onChange };
  const optionsRef = useRef(rangeOptions);
  optionsRef.current = rangeOptions;

  const [value, setValueState] = useState(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const instance = Range.getOrCreateInstance(el, optionsRef.current);
    instanceRef.current = instance;
    setValueState(instance.getValue());

    const handleInput = (event) => {
      setValueState(event.detail.value);
      callbacksRef.current.onInput?.(event.detail.value, event.detail.index);
    };

    const handleChange = (event) => {
      setValueState(event.detail.value);
      callbacksRef.current.onChange?.(event.detail.value, event.detail.index);
    };

    el.addEventListener("hygular.range.input", handleInput);
    el.addEventListener("hygular.range.change", handleChange);

    return () => {
      el.removeEventListener("hygular.range.input", handleInput);
      el.removeEventListener("hygular.range.change", handleChange);
      instance.dispose();
      instanceRef.current = null;
    };
  }, []);

  const getValue = useCallback(() => {
    return instanceRef.current?.getValue() ?? value;
  }, [value]);

  const setValue = useCallback((newValue) => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.setValue(newValue);
    setValueState(instance.getValue());
  }, []);

  const refresh = useCallback(() => {
    instanceRef.current?.refresh();
  }, []);

  return {
    ref: elementRef,
    value,
    getValue,
    setValue,
    refresh,
    instance: instanceRef.current,
  };
}
