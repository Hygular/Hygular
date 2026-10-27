/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useCallback } from "react";
import Toast from "../js/components/Toast.js";

/**
 * Provides helpers for creating toast components.
 */
export function useToast() {
  const success = useCallback((message, options = {}) => {
    return Toast.show({ ...options, message, status: "success" });
  }, []);

  const danger = useCallback((message, options = {}) => {
    return Toast.show({ ...options, message, status: "danger" });
  }, []);

  const warning = useCallback((message, options = {}) => {
    return Toast.show({ ...options, message, status: "warning" });
  }, []);

  const info = useCallback((message, options = {}) => {
    return Toast.show({ ...options, message, status: "info" });
  }, []);

  const show = useCallback((options = {}) => {
    return Toast.show(options);
  }, []);

  return { success, danger, warning, info, show };
}
