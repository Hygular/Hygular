import {
  Hygular,
  Range,
  Modal,
  Toast,
  type HygularAttributes,
  type PopoverOptions,
} from "hygular";
import { useRange, useSelect, usePopover } from "hygular/react";
const attributes: HygularAttributes = {
  "data-hygular": "range",
  "data-tab": "#panel",
  "data-tab-indicator": true,
  "data-skeleton-layout": "card",
};
const options: PopoverOptions = { content: "Help", trigger: "manual" };
const element = document.createElement("div");
new Hygular().dispose();
new Range(element).setValue(20);
Toast.show({ message: "Saved" }).dismiss();
Modal.confirm({ heading: "Continue?" });
useRange({ onChange: (value) => void value });
usePopover(options);
useSelect(element);
// @ts-expect-error The runtime reads data-tab, not the obsolete prefixed form.
const obsolete: HygularAttributes = { "data-hygular-tab": "#panel" };
void attributes;
void obsolete;

import { Skeleton, LazyImage } from "hygular";
const stopSkeleton = Skeleton.mount();
const stopImages = LazyImage.observe();
stopSkeleton();
stopImages();
