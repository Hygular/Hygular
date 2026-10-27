/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useCallback } from "react";
import Alert from "../js/components/Alert.js";

/**
 * Return stable helpers for creating alerts with optional status presets.
 */
export function useAlert() {
  const show = useCallback((selector, options = {}) => {
    return Alert.create(selector, options);
  }, []);

  const success = useCallback((selector, options = {}) => {
    return Alert.create(selector, { ...options, status: "success" });
  }, []);

  const danger = useCallback((selector, options = {}) => {
    return Alert.create(selector, { ...options, status: "danger" });
  }, []);

  const warning = useCallback((selector, options = {}) => {
    return Alert.create(selector, { ...options, status: "warning" });
  }, []);

  const info = useCallback((selector, options = {}) => {
    return Alert.create(selector, { ...options, status: "info" });
  }, []);

  return { show, success, danger, warning, info };
}
