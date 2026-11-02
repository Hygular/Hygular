/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import { useCallback } from "react";
import Modal from "../js/components/Modal.js";

/**
 * Return stable helpers for opening dialogs directly or through the queue.
 */
export function useModal() {
  const alert = useCallback((options = {}) => {
    return Modal.alert(options);
  }, []);

  const confirm = useCallback((options = {}) => {
    return Modal.confirm(options);
  }, []);

  const custom = useCallback((options = {}) => {
    return Modal.custom(options);
  }, []);

  const queueAlert = useCallback((options = {}) => {
    return Modal.queue.alert(options);
  }, []);

  const queueConfirm = useCallback((options = {}) => {
    return Modal.queue.confirm(options);
  }, []);

  return {
    alert,
    confirm,
    custom,
    queue: {
      alert: queueAlert,
      confirm: queueConfirm,
    },
  };
}
