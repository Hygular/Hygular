/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useEffect, useRef, useCallback } from "react";
import DarkMode from "../js/components/DarkMode.js";

/**
 * Initialize theme controls on mount and dispose them on unmount. Return a
 * function that reads the current theme.
 */
export function useDarkMode(options = {}) {
  const instanceRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const { onChange, ...darkModeOptions } = options;

    const instance = new DarkMode(darkModeOptions);

    if (typeof onChange === "function") {
      instance.onChange(onChange);
    }

    instanceRef.current = instance;

    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  const isDark = useCallback(() => {
    return instanceRef.current?.isDark() ?? false;
  }, []);

  return { isDark };
}
