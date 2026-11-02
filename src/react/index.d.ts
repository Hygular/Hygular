/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

import type {} from "react";
import type {
  Alert,
  AlertOptions,
  CarouselOptions,
  CustomModalOptions,
  DarkModeOptions as CoreDarkModeOptions,
  ElementTarget,
  HygularAttributes,
  ModalOptions,
  ModalQueue,
  PopoverOptions,
  Range,
  RangeIndex,
  RangeOptions as CoreRangeOptions,
  RangeValue,
  Select,
  SelectOptions as CoreSelectOptions,
  SkeletonErrorOptions,
  Toast,
  ToastOptions,
  TooltipOptions,
} from "../../index.js";

// This relative type-only path also resolves from dist/react/index.d.ts.
export type {
  Alert,
  AlertOptions,
  CarouselAutoplayOptions,
  CarouselOptions,
  CarouselThumbnailOptions,
  CustomModalOptions,
  DataBoolean,
  DataNumber,
  DataPresence,
  DismissAnimation,
  ElementTarget,
  HygularAttributes,
  HygularComponent,
  HygularToggle,
  ModalCloseReason,
  ModalIconType,
  ModalOptions,
  ModalQueue,
  PopoverOptions,
  PopoverPlacement,
  PopoverTrigger,
  RangeEventDetail,
  RangeIndex,
  RangeValue,
  SelectOptionItem,
  SelectValue,
  SkeletonErrorOptions,
  SkeletonLayout,
  StatusVariant,
  Toast,
  ToastOptions,
  TooltipOptions,
  TooltipPlacement,
} from "../../index.js";

export type {
  Select as SelectInstance,
  SelectOptionItem as SelectOption,
  Range as RangeInstance,
} from "../../index.js";

/** Nullable object ref compatible with React 17, 18, and 19. */
export interface HygularRef<T> {
  readonly current: T | null;
}

declare module "react" {
  interface HTMLAttributes<T> extends HygularAttributes {}
}

export interface DarkModeOptions extends CoreDarkModeOptions {
  /**
   * Called for later theme changes; set React state here to subscribe the UI.
   */
  onChange?: (isDark: boolean) => void;
}

export interface SelectOptions extends CoreSelectOptions {
  /** Selected values are serialized as a comma-separated string. */
  onChange?: (value: string) => void;
}

export interface RangeOptions extends CoreRangeOptions {
  /**
   * Called for native input events, including those dispatched by setValue().
   */
  onInput?: (value: RangeValue, index: RangeIndex) => void;
  /**
   * Called for native change events.
   */
  onChange?: (value: RangeValue, index: RangeIndex) => void;
}

export interface AlertAPI {
  /**
   * Create an alert beside the target, or return null if the target is
   * unavailable.
   */
  show(target: ElementTarget, options?: AlertOptions): Alert | null;
  success(
    target: ElementTarget,
    options?: Omit<AlertOptions, "status">,
  ): Alert | null;
  danger(
    target: ElementTarget,
    options?: Omit<AlertOptions, "status">,
  ): Alert | null;
  warning(
    target: ElementTarget,
    options?: Omit<AlertOptions, "status">,
  ): Alert | null;
  info(
    target: ElementTarget,
    options?: Omit<AlertOptions, "status">,
  ): Alert | null;
}

export interface CarouselAPI<T extends HTMLElement = HTMLDivElement> {
  /**
   * Attach to the carousel root when no target is supplied.
   */
  ref: HygularRef<T>;
  next(): void;
  prev(): void;
  /** Navigate to a one-based slide index. */
  go(index: number): void;
}

export interface SkeletonAPI<T extends HTMLElement = HTMLDivElement> {
  /**
   * Attach to the loading host.
   */
  ref: HygularRef<T>;
  /**
   * Activate loading placeholders.
   */
  show(): void;
  /**
   * Hide active loading placeholders.
   */
  hide(): void;
  /**
   * Display an error state on the host.
   */
  error(options?: SkeletonErrorOptions): void;
  /** Return undefined without a mounted host; otherwise return the task result. */
  wrap<R>(
    task: () => R | PromiseLike<R>,
    options?: SkeletonErrorOptions,
  ): Promise<Awaited<R>> | undefined;
}

export interface ModalAPI {
  alert(options?: ModalOptions): Promise<void | "guard-exit">;
  confirm(options?: ModalOptions): Promise<boolean | "guard-exit">;
  custom(options: CustomModalOptions): Promise<void>;
  queue: ModalQueue;
}

export interface ToastAPI {
  show(options?: ToastOptions): Toast;
  success(
    message: string,
    options?: Omit<ToastOptions, "status" | "message">,
  ): Toast;
  danger(
    message: string,
    options?: Omit<ToastOptions, "status" | "message">,
  ): Toast;
  warning(
    message: string,
    options?: Omit<ToastOptions, "status" | "message">,
  ): Toast;
  info(
    message: string,
    options?: Omit<ToastOptions, "status" | "message">,
  ): Toast;
}

export interface SelectAPI {
  /**
   * Underlying instance ref; current is null before initialization and after
   * cleanup.
   */
  instance: HygularRef<Select>;
}

export interface DarkModeAPI {
  /** Read the current theme; this does not subscribe a render to theme changes. */
  isDark(): boolean;
}

export interface RangeAPI<T extends HTMLElement = HTMLDivElement> {
  /**
   * Attach to the host containing the native range inputs.
   */
  ref: HygularRef<T>;
  /**
   * Current value or pair, initially null until the mount effect initializes
   * the instance.
   */
  value: RangeValue | null;
  /**
   * Read the live instance value, falling back to the current React state.
   */
  getValue(): RangeValue | null;
  /**
   * Set the range value or pair and update React state.
   */
  setValue(value: RangeValue): void;
  /**
   * Rebuild ticks and refresh the instance display.
   */
  refresh(): void;
  /** Instance captured by the current render, initially null. */
  instance: Range | null;
}

// Delegated handlers

/**
 * Register delegated navbar toggles and remove their handlers on unmount.
 * Mount once in the application shell.
 */
export function useNavbar(): void;
/**
 * Register delegated drawer interactions and run their cleanup on unmount.
 * Mount once in the application shell.
 */
export function useDrawer(): void;
/**
 * Register dropdown click, Escape, and supported hover interactions. Mount
 * once in the application shell.
 */
export function useDropdown(): void;
/**
 * Register delegated collapse toggles and remove their handlers on unmount.
 * Mount once in the application shell.
 *
 * @example
 * import { useCollapse } from "hygular/react";
 *
 * export function DetailsSection() {
 *   useCollapse();
 *   return (
 *     <>
 *       <button data-hygular-toggle="collapse" data-target="#example-details">
 *         Toggle details
 *       </button>
 *       <div id="example-details">Additional details</div>
 *     </>
 *   );
 * }
 */
export function useCollapse(): void;
/**
 * Register accordion toggles and apply the initial open state. Mount once in
 * the application shell.
 */
export function useAccordion(): void;
/**
 * Register delegated alert dismissal and restore persisted dismissals. Mount
 * once in the application shell.
 */
export function useAlertDismiss(): void;
/**
 * Register form validation, submission, file-display, and floating-label
 * handlers. Mount once in the application shell.
 *
 * @example
 * import { useForm } from "hygular/react";
 *
 * export function SignupForm() {
 *   useForm();
 *   return (
 *     <form data-hygular="form" action="/signup" method="post">
 *       <label>
 *         Email
 *         <input className="form-input" type="email" name="email" required />
 *       </label>
 *       <button type="submit">Sign up</button>
 *     </form>
 *   );
 * }
 */
export function useForm(): void;

// Element-bound hooks

/**
 * Initialize tabs on the returned ref and dispose their handlers on unmount.
 * Tab targets are selected with data-tab.
 *
 * @example
 * import { useTabview } from "hygular/react";
 *
 * export function Tabs() {
 *   const ref = useTabview<HTMLDivElement>();
 *   return (
 *     <>
 *       <div ref={ref} role="tablist" data-tab-indicator="true">
 *         <button data-tab="#example-overview">Overview</button>
 *         <button data-tab="#example-details">Details</button>
 *       </div>
 *       <section id="example-overview">Overview content</section>
 *       <section id="example-details">Details content</section>
 *     </>
 *   );
 * }
 */
export function useTabview<
  T extends HTMLElement = HTMLDivElement,
>(): HygularRef<T>;
/**
 * Enable pointer dragging on a horizontal scroll container. Detach the
 * handlers on unmount.
 *
 * @example
 * import { useSwiper } from "hygular/react";
 *
 * export function ScrollStrip() {
 *   const ref = useSwiper<HTMLDivElement>();
 *   return (
 *     <div ref={ref} style={{ display: "flex", overflowX: "auto", width: 240 }}>
 *       <div className="swiper-wrapper" style={{ display: "flex", overflowX: "auto" }}>
 *         <span style={{ minWidth: 200 }}>First item</span>
 *         <span style={{ minWidth: 200 }}>Second item</span>
 *       </div>
 *     </div>
 *   );
 * }
 */
export function useSwiper<
  T extends HTMLElement = HTMLDivElement,
>(): HygularRef<T>;
/**
 * Format data-count as badge text, capping values at 99+. count
 * triggers reformatting; keep the attribute in sync with it.
 *
 * @example
 * import { useBadge } from "hygular/react";
 *
 * export function MessageCount({ count }: { count: number }) {
 *   const ref = useBadge<HTMLSpanElement>(count);
 *   return <span className="badge" ref={ref} data-count={count} />;
 * }
 */
export function useBadge<T extends HTMLElement = HTMLSpanElement>(
  count?: number | string,
): HygularRef<T>;
/**
 * Attach a tooltip using the initial options and dispose it on unmount. Attach
 * the returned ref to the trigger element.
 *
 * @example
 * import { useTooltip } from "hygular/react";
 *
 * export function CopyButton() {
 *   const ref = useTooltip<HTMLButtonElement>({
 *     message: "Copy to clipboard",
 *     placement: "top",
 *   });
 *   return <button ref={ref}>Copy</button>;
 * }
 */
export function useTooltip<T extends HTMLElement = HTMLElement>(
  options?: TooltipOptions,
): HygularRef<T>;
/**
 * Attach a popover using the initial options and dispose it on unmount.
 * Content is plain text or a DOM node, not a React element.
 *
 * @example
 * import { usePopover } from "hygular/react";
 *
 * export function InfoButton() {
 *   const ref = usePopover<HTMLButtonElement>({
 *     title: "Details",
 *     content: "Additional information about this item.",
 *   });
 *   return <button ref={ref}>More information</button>;
 * }
 */
export function usePopover<T extends HTMLElement = HTMLElement>(
  options?: PopoverOptions,
): HygularRef<T>;

// Component helpers

/**
 * Return helpers for inserting alerts beside a target. Each helper returns an
 * Alert instance, or null when the target is unavailable.
 *
 * @example
 * import { useAlert } from "hygular/react";
 *
 * export function AlertExample() {
 *   const alert = useAlert();
 *   return (
 *     <>
 *       <button onClick={() => alert.info("#example-status", { message: "Ready." })}>
 *         Show status
 *       </button>
 *       <div id="example-status" />
 *     </>
 *   );
 * }
 */
export function useAlert(): AlertAPI;
/**
 * Initialize a carousel from a selector, supplied ref, or returned ref.
 * Options are read on mount; the instance is disposed on unmount.
 *
 * @example
 * import { useCarousel } from "hygular/react";
 *
 * export function Slides() {
 *   const { ref, next } = useCarousel<HTMLDivElement>(null, {
 *     autoplay: { enabled: false },
 *   });
 *   return (
 *     <>
 *       <div className="carousel" ref={ref}>
 *         <div className="carousel-items">
 *           <div className="item">First slide</div>
 *           <div className="item">Second slide</div>
 *         </div>
 *       </div>
 *       <button onClick={next}>Next slide</button>
 *     </>
 *   );
 * }
 */
export function useCarousel<T extends HTMLElement = HTMLDivElement>(
  target?: string | T | HygularRef<T> | null,
  options?: CarouselOptions,
): CarouselAPI<T>;
/**
 * Create a picker beside the target on mount and dispose it on unmount. Supply
 * options through data; changes are reported as a comma-separated string.
 *
 * @example
 * import { useRef } from "react";
 * import { useSelect } from "hygular/react";
 *
 * export function CountryPicker() {
 *   const ref = useRef<HTMLInputElement>(null);
 *   useSelect(ref, {
 *     inputName: "country",
 *     data: [
 *       { value: "az", name: "Azerbaijan" },
 *       { value: "tr", name: "Turkey" },
 *     ],
 *   });
 *   return <input type="hidden" ref={ref} />;
 * }
 */
export function useSelect<T extends HTMLElement = HTMLElement>(
  target: string | T | HygularRef<T>,
  options?: SelectOptions,
): SelectAPI;
/**
 * Manage loading and error states on the returned host ref. Marked hosts
 * activate on mount; active loading is hidden on unmount.
 *
 * @example
 * import { useSkeleton } from "hygular/react";
 *
 * export function LoadingExample() {
 *   const { ref, show, hide } = useSkeleton<HTMLDivElement>();
 *   return (
 *     <>
 *       <button onClick={show}>Show loading</button>
 *       <button onClick={hide}>Hide loading</button>
 *       <div ref={ref} data-skeleton-layout="card">Card content</div>
 *     </>
 *   );
 * }
 */
export function useSkeleton<
  T extends HTMLElement = HTMLDivElement,
>(): SkeletonAPI<T>;
/**
 * Return helpers for immediate and queued dialogs. Call them from event
 * handlers or effects, not during rendering.
 *
 * @example
 * import { useModal } from "hygular/react";
 *
 * export function ConfirmButton() {
 *   const modal = useModal();
 *   const confirm = async () => {
 *     const accepted = await modal.confirm({ heading: "Continue?" });
 *     if (accepted) await modal.alert({ content: "Confirmed." });
 *   };
 *   return <button onClick={confirm}>Continue</button>;
 * }
 */
export function useModal(): ModalAPI;
/**
 * Return toast helpers with optional status presets. Each call returns the
 * underlying Toast instance.
 *
 * @example
 * import { useToast } from "hygular/react";
 *
 * export function NotifyButton() {
 *   const toast = useToast();
 *   return (
 *     <button onClick={() => toast.success("Changes saved.")}>
 *       Show notification
 *     </button>
 *   );
 * }
 */
export function useToast(): ToastAPI;
/**
 * Initialize theme controls on mount and dispose them on unmount. isDark()
 * reads the current theme without subscribing the component to changes.
 *
 * @example
 * import { useDarkMode } from "hygular/react";
 *
 * export function ThemeButton() {
 *   useDarkMode({ customBtn: "#example-theme-toggle", autoCreateBtn: false });
 *   return <button id="example-theme-toggle">Switch theme</button>;
 * }
 */
export function useDarkMode(options?: DarkModeOptions): DarkModeAPI;
/**
 * Attach range controls to a host and mirror their values in React state. The
 * host must contain one or two range inputs. Options are read on mount;
 * event callbacks use the latest render.
 *
 * @example
 * import { useRange } from "hygular/react";
 *
 * export function VolumeControl() {
 *   const { ref, value, setValue } = useRange<HTMLDivElement>({
 *     valueLabel: (value) => `${value}%`,
 *   });
 *   return (
 *     <>
 *       <div ref={ref} style={{ position: "relative" }}>
 *         <input
 *           className="form-range"
 *           type="range"
 *           min="0"
 *           max="100"
 *           defaultValue="50"
 *           aria-label="Volume"
 *         />
 *       </div>
 *       <output>{Array.isArray(value) ? value.join(" – ") : value}</output>
 *       <button onClick={() => setValue(50)}>Reset</button>
 *     </>
 *   );
 * }
 */
export function useRange<T extends HTMLElement = HTMLDivElement>(
  options?: RangeOptions,
): RangeAPI<T>;
