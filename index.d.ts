/*!
 * Hygular v1.0.0-beta.2
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

export type ElementTarget<T extends Element = HTMLElement> = string | T;
export type Cleanup = () => void;

export interface Disposable {
  dispose(): void;
}

export type StatusVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "default";
export type DismissAnimation = "fade" | "slide";

// Toast

export interface ToastOptions {
  /** Plain-text notification content. */
  message?: string;
  /** Status color. Default: "default". */
  status?: StatusVariant;
  /** Default: "bottom". */
  position?: "top" | "bottom";
  /** Auto-dismiss delay in milliseconds, clamped to 1000–10000. Default: 4000. */
  duration?: number;
  /** Dismiss existing toasts in the same position container. Default: false. */
  dismissPrevious?: boolean;
  /** Show a status icon. Default: false. */
  showIcon?: boolean;
  /** Clear remaining instance state after dismissal. Default: false. */
  autoClean?: boolean;
}

/**
 * Display a transient notification. Use dismiss() to remove it before its
 * timer expires.
 *
 * @example
 * import { Toast } from "hygular";
 *
 * Toast.show({
 *   message: "Changes saved.",
 *   status: "success",
 *   duration: 3000,
 * });
 */
export class Toast implements Disposable {
  /** Prepare an instance. Use Toast.show() to display it immediately. */
  constructor(options?: ToastOptions);
  /** Registry of instances keyed by their generated IDs. */
  static readonly instances: Map<string, Toast>;
  /** Create and display a toast, returning its instance. */
  static show(options?: ToastOptions): Toast;
  /** Create the toast element and start its dismissal timer. */
  build(): void;
  /** Remove the toast and cancel automatic dismissal. */
  dismiss(): void;
  /** Remove the toast, cancel its timer, and unregister the instance. */
  dispose(): void;
}

// Alert

export interface AlertOptions {
  /** Plain-text alert content. */
  message?: string;
  /** Status color. Default: "default". */
  status?: StatusVariant;
  /** Show a status icon. Default: false. */
  hasIcon?: boolean;
  /** Include a dismiss button. Default: true. */
  dismissible?: boolean;
  /** Default: "before". */
  position?: "before" | "after";
  /** Enable the entrance animation. Default: true. */
  animated?: boolean;
  /** Dismiss animation. Default: "fade". */
  animation?: DismissAnimation;
  /** Keep the alert border. Default: false. */
  bordered?: boolean;
  /** Clear remaining references after dismissal. Default: false. */
  autoClean?: boolean;
}

/**
 * Insert a dismissible text alert beside an existing element. create() returns
 * null when the target cannot be found.
 *
 * @example
 * import { Alert } from "hygular";
 *
 * Alert.create("#account-form", {
 *   message: "Please check the highlighted fields.",
 *   status: "warning",
 *   position: "before",
 * });
 */
export class Alert implements Disposable {
  /** Prepare an alert for an existing target. Use Alert.create() to insert it immediately. */
  constructor(target: ElementTarget, options?: AlertOptions);
  /** Create and insert an alert, or return null if the target is unavailable. */
  static create(target: ElementTarget, options?: AlertOptions): Alert | null;
  /** Insert an alert beside the target and return the generated element. */
  build(): HTMLDivElement | undefined;
  /** Remove generated alerts and release handlers, timers, and animations. */
  dispose(): void;
}

// Modal

export type ModalType = "default" | "confirm" | "custom";
export type ModalCloseReason =
  | "dismiss"
  | "confirm"
  | "esc"
  | "backdrop"
  | "guard-exit";
export type ModalIconType = "none" | "success" | "error" | "warning" | "info";
export type ModalResult<T extends ModalType> = T extends "confirm"
  ? boolean | "guard-exit"
  : T extends "default"
    ? void | "guard-exit"
    : void;

export interface ModalOptions {
  /** Plain-text heading. */
  heading?: string;
  /** Plain text; HTML and React elements are not rendered. */
  content?: string;
  /** Vertical dialog alignment. Default: "center" for generated dialogs. */
  align?: "top" | "center" | "bottom";
  /** Clear references after a generated dialog closes. Default: false. */
  dispose?: boolean;
  /** Dismiss button label for alert dialogs. Default: "OK". */
  dismissText?: string;
  /** Confirmation button labels. Defaults: "No" and "Yes". */
  actions?: { cancelText?: string; confirmText?: string };
  /** Status icon for a generated dialog. Hidden by default. */
  icon?: { visible?: boolean; type?: ModalIconType };
  /** Use the guard action instead of standard dismissal in generated dialogs. */
  guardMode?: boolean;
  /** Guard action label. Default: "Go here". */
  guardButtonText?: string;
  /** Additional CSS classes for the guard action. */
  guardButtonClass?: string;
  /** Destination URL for the guard action. */
  guardButtonUrl?: string;
  /** Default: true for alert/custom dialogs, false for confirmations. */
  closeOnEsc?: boolean;
  /** Allow backdrop-click handling on generated dialogs. Default: true. */
  backdrop?: boolean;
  /** Default: true for alert/custom dialogs, false for confirmations. */
  backdropClose?: boolean;
  /** Move initial focus to the dialog. Default: true. */
  focusFirst?: boolean;
  /** Existing custom modal element or its selector. */
  id?: ElementTarget;
  /** Return false to cancel opening. */
  onOpen?: (modal: HTMLElement) => boolean | void;
  /** Called after the opening delay, unless the dialog has already closed. */
  onOpened?: (modal: HTMLElement) => void;
  /** Return false to cancel closing. */
  onClose?: (modal: HTMLElement, reason: ModalCloseReason) => boolean | void;
  /** Called once the closing transition or its timeout has completed. */
  onClosed?: (modal: HTMLElement, reason: ModalCloseReason) => void;
}

export interface CustomModalOptions extends ModalOptions {
  id: ElementTarget;
}

export interface ModalQueue {
  alert(options?: ModalOptions): Promise<void | "guard-exit">;
  confirm(options?: ModalOptions): Promise<boolean | "guard-exit">;
}

export type ModalQueueItem = {
  [T in ModalType]: {
    type: T;
    options?: ModalOptions;
    resolve?: (result: ModalResult<T>) => void;
    reject?: (reason: unknown) => void;
  };
}[ModalType];

/**
 * Open alert, confirmation, or existing custom dialogs. Each helper returns a
 * promise for the dialog result.
 *
 * @example
 * import { Modal } from "hygular";
 *
 * const confirmed = await Modal.confirm({
 *   heading: "Delete item?",
 *   content: "This action cannot be undone.",
 *   actions: { cancelText: "Keep", confirmText: "Delete" },
 * });
 * if (confirmed) {
 *   await Modal.alert({ content: "Deletion confirmed." });
 * }
 */
export class Modal<T extends ModalType = ModalType> implements Disposable {
  /** Prepare a dialog of the given type. build() opens it. */
  constructor(type: T, options?: ModalOptions);
  type: T;
  static TRANSITION_DURATION: number;
  static TRANSITION_BUFFER: number;
  /** Append a request to the shared dialog queue. */
  static enqueue(item: ModalQueueItem): void;
  /** Open an informational dialog. The promise resolves when it closes. */
  static alert(options?: ModalOptions): Promise<void | "guard-exit">;
  /** Resolve true on confirmation or false on dismissal. */
  static confirm(options?: ModalOptions): Promise<boolean | "guard-exit">;
  /** Open an existing modal. Reject if the target cannot be found. */
  static custom(options: CustomModalOptions): Promise<void>;
  /** Process requests in order, awaiting each result before starting the next. */
  static queue: ModalQueue;
  /** Open the prepared dialog and return its result promise. */
  build(): Promise<ModalResult<T>>;
  /** Cancel pending work, release the scroll lock, and remove generated markup. */
  dispose(): void;
}

// Carousel

export interface CarouselAutoplayOptions {
  /** Enable automatic advancement. Default: true. */
  enabled?: boolean;
  /** Delay between advances in milliseconds. Default: 4000. */
  interval?: number;
  /** Pause while the pointer is over the carousel. Default: true. */
  pauseOnHover?: boolean;
  /** Pause during swipe interaction. Default: true. */
  pauseOnSwipe?: boolean;
}

export interface CarouselThumbnailOptions {
  /** Use thumbnail navigation. Default: false. */
  enabled?: boolean;
  /** Allow thumbnail clicks to select a slide. Default: true. */
  clickable?: boolean;
}

export interface CarouselOptions {
  /** Transition style. Default: "slide". */
  mode?: "slide" | "fade";
  /** Automatic advancement settings; omitted fields retain their defaults. */
  autoplay?: CarouselAutoplayOptions;
  /** Show previous and next controls. Default: true. */
  controls?: boolean;
  /** Show dot navigation when thumbnails are disabled. Default: true. */
  pager?: boolean;
  /** Thumbnail navigation settings. */
  thumbnails?: CarouselThumbnailOptions;
  /** Enable swipe navigation. Default: true. */
  swipe?: boolean;
  /** Wrap navigation at either end. Default: true. */
  loop?: boolean;
}

export interface CarouselDefaults extends Required<CarouselOptions> {
  autoplay: Required<CarouselAutoplayOptions>;
  thumbnails: Required<CarouselThumbnailOptions>;
}

/**
 * Navigate slides using controls, gestures, or autoplay. The root must contain
 * .carousel-items with one or more slide children.
 *
 * @example
 * import { Carousel } from "hygular";
 *
 * const root = document.createElement("div");
 * root.className = "carousel";
 * root.innerHTML = `
 *   <div class="carousel-items">
 *     <div class="item">First slide</div>
 *     <div class="item">Second slide</div>
 *   </div>
 * `;
 * document.body.append(root);
 *
 * const carousel = Carousel.create(root, { autoplay: { enabled: false } });
 * carousel?.go(2);
 */
export class Carousel implements Disposable {
  /** Prepare a carousel. Use Carousel.create() to build it immediately. */
  constructor(target: ElementTarget, options?: CarouselOptions);
  static defaults: CarouselDefaults;
  static readonly instances: Map<string, Carousel>;
  /** Return null when the root, slide container, or slides are missing. */
  static create(
    target: ElementTarget,
    options?: CarouselOptions,
  ): Carousel | null;
  /** Look up an instance by its generated ID. */
  static get(id: string): Carousel | undefined;
  /** Create controls and navigation, then activate the first slide. */
  build(): void;
  /** Navigate to a one-based slide index. */
  go(index: number): void;
  next(): void;
  prev(): void;
  /** Stop autoplay, detach handlers, and remove generated navigation controls. */
  dispose(): void;
}

// Tooltip and popover

export type TooltipPlacement = "auto" | "top" | "bottom" | "left" | "right";

export interface TooltipOptions {
  /** Plain-text tooltip content. */
  message?: string;
  /** Preferred side; fall back when space is insufficient. Default: "auto". */
  placement?: TooltipPlacement;
  /** Show the directional arrow. Default: true. */
  hasArrow?: boolean;
  /** Dispose the instance after hiding. Default: false. */
  autoClean?: boolean;
}

/**
 * Attach a text tooltip to an element. Mouse, touch, and focus interactions
 * are bound during construction.
 *
 * @example
 * import { Tooltip } from "hygular";
 *
 * const button = document.querySelector<HTMLButtonElement>("#copy-button");
 * if (button) {
 *   new Tooltip(button, { message: "Copy to clipboard", placement: "top" });
 * }
 */
export class Tooltip implements Disposable {
  constructor(target: ElementTarget, options?: TooltipOptions);
  /** Create and display the tooltip if it is hidden. */
  show(): void;
  /** Remove the visible tooltip and stop position updates. */
  hide(): void;
  /** Return the instance bound to this element, if any. */
  static getInstance(element: Element): Tooltip | undefined;
  /** Initialize elements matching the selector, reusing existing instances. */
  static init(selector?: string): Tooltip[];
  /** Release the tooltip instance and its event handlers. */
  dispose(): void;
}

export type PopoverPlacement =
  | TooltipPlacement
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end"
  | "left-start"
  | "left-end"
  | "right-start"
  | "right-end";
export type PopoverTrigger = "click" | "manual";

export interface PopoverOptions {
  /** Plain-text header. */
  title?: string;
  /** Text or a DOM node to clone into the body. */
  content?: string | Node;
  /** Selector of an element whose children should be cloned as content. */
  target?: string | null;
  /** Preferred side and alignment. Default: "auto". */
  placement?: PopoverPlacement;
  /** Use click interaction or control visibility through methods. Default: "click". */
  trigger?: PopoverTrigger;
  /** Show the directional arrow. Default: true. */
  hasArrow?: boolean;
  /** Hide on pointer interaction outside the trigger and panel. Default: true. */
  closeOnOutsideClick?: boolean;
  /** Hide when Escape is pressed. Default: true. */
  closeOnEscape?: boolean;
  /** Distance from the trigger in pixels. Default: 10. */
  offset?: number;
  /** Dispose the instance after hiding. Default: false. */
  autoClean?: boolean;
}

/**
 * Attach a content panel to a trigger. Body strings are plain text; DOM nodes
 * and target contents are cloned.
 *
 * @example
 * import { Popover } from "hygular";
 *
 * const button = document.querySelector<HTMLButtonElement>("#details-button");
 * if (button) {
 *   new Popover(button, {
 *     title: "Details",
 *     content: "Additional information about this item.",
 *     placement: "bottom-start",
 *   });
 * }
 */
export class Popover implements Disposable {
  constructor(target: ElementTarget, options?: PopoverOptions);
  /** Create and display the panel unless its show event is canceled. */
  show(): void;
  /** Hide the panel unless its hide event is canceled. */
  hide(): void;
  /** Switch between shown and hidden states. */
  toggle(): void;
  /** Recalculate the visible panel's position. */
  update(): void;
  /** Return the instance bound to this element, if any. */
  static getInstance(element: Element): Popover | undefined;
  /** Initialize matching triggers, reusing existing instances. */
  static init(selector?: string): Popover[];
  /** Remove the panel and release handlers, even when hide events are canceled. */
  dispose(): void;
}

// Select

export type SelectValue = string | number;

export interface SelectOptionItem {
  value: SelectValue;
  name: string;
  /** Image URL displayed beside the label. */
  icon?: string;
}

export interface SelectOptions {
  /** Name of the generated hidden input. Default: "select". */
  inputName?: string;
  /** Allow multiple selected values. Default: false. */
  multiple?: boolean;
  /** Initially selected value or values. */
  defaultValue?: SelectValue | readonly SelectValue[] | null;
  /** Option records used to build the list. */
  data?: readonly SelectOptionItem[];
  /** Include an option filter. Default: false. */
  search?: boolean;
  /** Label shown without a selection. Default: "--SELECT--". */
  placeholder?: string;
}

/**
 * Create an option picker beside an anchor element. Options come from data;
 * native option elements are not read.
 *
 * @example
 * import { Select } from "hygular";
 *
 * const anchor = document.createElement("input");
 * anchor.type = "hidden";
 * document.body.append(anchor);
 *
 * new Select(anchor, {
 *   inputName: "country",
 *   search: true,
 *   data: [
 *     { value: "az", name: "Azerbaijan" },
 *     { value: "tr", name: "Turkey" },
 *   ],
 * });
 */
export class Select implements Disposable {
  constructor(target: ElementTarget, options?: SelectOptions);
  static defaults: Required<SelectOptions>;
  static variables: { animationDuration: number };
  /** Select an option and dispatch change on the anchor element. */
  select(option: SelectOptionItem): void;
  /** Remove an option from the selected values. */
  remove(value: SelectValue): void;
  /** Open the option list. */
  open(): void;
  /** Close the option list. */
  close(): void;
  /** Toggle the option list. */
  toggle(): void;
  /** Remove the generated control, detach handlers, and disconnect its observer. */
  dispose(): void;
}

// Theme

export interface DarkModeOptions {
  /** Selector for the generated toggle's container. Default: "body". */
  container?: string;
  /** Custom button selector; false falls back to autoCreateBtn. */
  customBtn?: string | false;
  /** Create a toggle when no custom button is configured. Default: true. */
  autoCreateBtn?: boolean;
}

/**
 * Manage theme controls and stored preferences. Follow system changes while no
 * explicit preference is stored.
 *
 * @example
 * import { DarkMode } from "hygular";
 *
 * const theme = new DarkMode({ autoCreateBtn: true });
 * theme.onChange((isDark) => {
 *   console.log(isDark ? "Dark theme" : "Light theme");
 * });
 */
export class DarkMode implements Disposable {
  constructor(options?: DarkModeOptions);
  /** Read the current theme. */
  isDark(): boolean;
  /** Register a callback for later theme changes. */
  onChange(callback: (isDark: boolean) => void): void;
  /** Remove generated controls and detach button and system-preference listeners. */
  dispose(): void;
}

// Loading states

export interface SkeletonErrorOptions {
  /** Error text. Default: "Failed to load". */
  message?: string;
  /** Show a retry button. Default: false. */
  retry?: boolean;
  /** Called with the host element after the retry button clears the error state. */
  onRetry?: ((element: HTMLElement) => void) | null;
}

/**
 * Manage loading placeholders and error states on existing elements. Use
 * wrap() to keep loading tied to an asynchronous task.
 *
 * @example
 * import { Skeleton } from "hygular";
 *
 * const card = document.querySelector<HTMLElement>("#summary");
 * if (card) {
 *   try {
 *     await Skeleton.wrap(card, async () => {
 *       const response = await fetch("/api/summary");
 *       if (!response.ok) throw new Error("Could not load the summary.");
 *       card.textContent = await response.text();
 *     });
 *   } catch (error) {
 *     console.error(error);
 *   }
 * }
 */
export class Skeleton {
  private constructor();
  /** Activate loading placeholders on the host. */
  static show(element: HTMLElement | null): void;
  /** Remove active loading placeholders and restore host accessibility state. */
  static hide(element: HTMLElement | null): void;
  /** Replace the loading state with an error message. */
  static error(
    element: HTMLElement | null,
    options?: SkeletonErrorOptions,
  ): void;
  /** Show loading while the task runs; display an error and rethrow on failure. */
  static wrap<T>(
    element: HTMLElement,
    task: () => T | PromiseLike<T>,
    options?: SkeletonErrorOptions,
  ): Promise<Awaited<T>>;
  /** Activate marked targets and observe additions, respecting the auto flag. */
  static mount(): () => void;
}

/**
 * Load deferred image sources near the viewport. observe() also watches for
 * images added later.
 *
 * @example
 * import { LazyImage } from "hygular";
 *
 * const image = document.createElement("img");
 * image.alt = "Mountain landscape";
 * image.dataset.src = "/images/mountains.jpg";
 * document.body.append(image);
 * LazyImage.observe();
 */
export class LazyImage {
  private constructor();
  /** Load the element's deferred source with shimmer and error handling. */
  static load(image: HTMLImageElement): void;
  /** Observe matching images and newly inserted matches for deferred loading. */
  static observe(selector?: string): () => void;
}

// Range

export type RangeValue = number | [number, number];
export type RangeIndex = 0 | 1;

export interface RangeOptions {
  /** Show thumb tooltips. Default: true. */
  tooltip?: boolean;
  /** Render ticks from the input's datalist. Default: true. */
  ticks?: boolean;
  /** Template containing {value}, or a formatter receiving input.value. */
  valueLabel?: string | ((value: string) => string) | null;
}

export interface RangeEventDetail {
  value: RangeValue;
  index: RangeIndex;
}

/**
 * Add tooltips, ticks, and value controls to native range inputs. The host
 * must contain one or two input[type="range"] elements.
 *
 * @example
 * import { Range } from "hygular";
 *
 * const host = document.createElement("div");
 * host.style.position = "relative";
 * host.innerHTML = `
 *   <input class="form-range" type="range" min="0" max="100" value="50">
 * `;
 * document.body.append(host);
 *
 * const range = Range.getOrCreateInstance(host, {
 *   valueLabel: (value) => `${value}%`,
 * });
 * range.setValue(75);
 */
export class Range implements Disposable {
  /** The host must contain one or two input[type="range"] elements. */
  constructor(element: HTMLElement, options?: RangeOptions);
  static NAME: string;
  static SELECTOR: string;
  /** Return the instance attached to the host, or null. */
  static getInstance(element: HTMLElement): Range | null;
  /** Reuse the host's instance or initialize one. */
  static getOrCreateInstance(
    element: HTMLElement,
    options?: RangeOptions,
  ): Range;
  /** Initialize marked range hosts beneath the root. */
  static init(root?: ParentNode): void;
  options: Required<RangeOptions>;
  /** Return one value or a [lower, upper] pair. */
  getValue(): RangeValue;
  /** Set native input values, update the display, and dispatch input events. */
  setValue(value: RangeValue): void;
  /** Rebuild ticks and refresh the displayed values. */
  refresh(): void;
  /** Recalculate fill and tooltip positions. */
  update(changedIndex?: RangeIndex): void;
  /** Format an input value using valueLabel. */
  formatValue(value: string): string;
  /** Detach handlers and observers, remove generated elements, and unregister the instance. */
  dispose(): void;
}

// Form validation

export type FormField =
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement;
export type ValidationRule = (
  value: string,
  parameter: string | undefined,
  field: FormField,
) => true | string;

/**
 * Register validation and submission handlers for marked forms. Custom rules
 * return true on success or an error message on failure.
 *
 * @example
 * import { Form } from "hygular";
 *
 * Form.addRule("short-name", (value) =>
 *   value.length <= 30 || "Use at most 30 characters.",
 * );
 * const cleanup = Form.init();
 * // Call cleanup() when the form behavior is no longer needed.
 */
export class Form {
  private constructor();
  /** Register a synchronous validation rule, replacing a rule with the same name. */
  static addRule(name: string, rule: ValidationRule): void;
  /** Register form handlers and return their cleanup function. */
  static init(): Cleanup;
}

export interface DebugAPI {
  enable(): void;
  disable(): void;
  set(enabled: boolean): void;
  readonly isEnabled: boolean;
  log(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
  group(label: string): void;
  groupEnd(): void;
}

/**
 * Control diagnostic output. log(), warn(), and groups require debug mode;
 * error() always writes to the console.
 *
 * @example
 * import { Debug } from "hygular";
 *
 * Debug.enable();
 * Debug.log("Initializing the page.");
 * Debug.disable();
 */
export const Debug: DebugAPI;

// Configuration

export interface FontConfig {
  /** Google Fonts family name. */
  family: string;
  /** Requested font weights. */
  weights?: string | number | readonly number[];
  /** Fallback family. Default: "sans-serif". */
  category?: string;
  /** Suffix for the generated font utility class. */
  alias?: string;
}

type KebabCase<S extends string> = S extends `${infer Head}${infer Tail}`
  ? `${Head extends Lowercase<Head> ? Head : `-${Lowercase<Head>}`}${KebabCase<Tail>}`
  : S;
type StyleProperty = {
  [K in keyof CSSStyleDeclaration]: CSSStyleDeclaration[K] extends string
    ? K
    : never;
}[keyof CSSStyleDeclaration] &
  string;

export type CSSPropertyName =
  | KebabCase<Exclude<StyleProperty, "cssText">>
  | `--${string}`
  | `-${"webkit" | "moz" | "ms" | "o"}-${string}`;

/** CSS property names use kebab-case, as they do in a stylesheet. */
export type CSSDeclarations = Partial<Record<CSSPropertyName, string | number>>;
export type CustomClassDefinition =
  | string
  | (CSSDeclarations & { dark?: CSSDeclarations });

export interface ThemeTokens {
  body?: string;
  bodyText?: string;
  primary?: string;
  primaryContrast?: string;
  font?: string;
  fontMono?: string;
  spaceXs?: string;
  spaceSm?: string;
  spaceMd?: string;
  spaceLg?: string;
  spaceXl?: string;
  space2xl?: string;
  /** Additional CSS custom properties; the -- prefix is added when omitted. */
  extend?: Record<string, string | number>;
}

export type Breakpoints = Record<string, string>;

export interface HygularThemeConfig extends ThemeTokens {
  /** Token overrides applied under the dark theme selector. */
  dark?: ThemeTokens;
  /** JIT breakpoint overrides. */
  breakpoints?: Breakpoints;
}

export interface JitConfig {
  /** Source directories, files, or glob patterns to scan. */
  scan?: readonly string[];
  /** Class names to retain even when they are not found in scanned sources. */
  safelist?: readonly string[];
  /** Additional source extensions, without a leading dot. */
  extensions?: readonly string[];
  /** Print scanner diagnostics. */
  debug?: boolean;
  /** Maximum concurrent file operations. Default: 50. */
  concurrency?: number;
}

/**
 * Runtime and JIT configuration. The compiler reads jit and breakpoint
 * settings; the browser runtime applies theme, classes, fonts, and debug.
 *
 * @example
 * import type { HygularConfig } from "hygular";
 *
 * const config = {
 *   theme: { primary: "#4f46e5", breakpoints: { md: "900px" } },
 *   classes: {
 *     surface: { padding: "1rem", dark: { background: "#18181b" } },
 *   },
 *   jit: { scan: ["src"], extensions: ["html"] },
 * } satisfies HygularConfig;
 */
export interface HygularConfig {
  debug?: boolean;
  theme?: HygularThemeConfig;
  classes?: Record<string, CustomClassDefinition>;
  fonts?: readonly FontConfig[];
  /** Used by the JIT compiler. */
  jit?: JitConfig;
  /** Used when theme.breakpoints is not supplied. */
  breakpoints?: Breakpoints;
}

export type LazyInitializer = (element: HTMLElement) => Disposable | void;

export interface ComponentRegistry {
  delegate: Record<string, () => Cleanup | void>;
  lazy: Record<string, LazyInitializer>;
}

/**
 * Apply runtime configuration and initialize delegated and lazy components.
 * Create one runtime per page and dispose it when that page is torn down.
 *
 * @example
 * import { Hygular } from "hygular";
 *
 * const app = new Hygular({
 *   theme: {
 *     primary: "#4f46e5",
 *     dark: { primary: "#818cf8" },
 *   },
 * });
 * app.toast.show({ message: "Welcome!" });
 */
export class Hygular implements Disposable {
  constructor(config?: HygularConfig);
  config: HygularConfig;
  modal: typeof Modal;
  toast: typeof Toast;
  carousel: typeof Carousel;
  alert: Pick<typeof Alert, "create">;
  darkMode: typeof DarkMode;
  select: typeof Select;
  skeleton: typeof Skeleton;
  tooltip: typeof Tooltip;
  popover: typeof Popover;
  form: typeof Form;
  range: typeof Range;
  registry: ComponentRegistry;
  /** Replace delegate handlers and observe existing lazy targets. */
  init(): void;
  /** Run a registered initializer and retain disposable instances for cleanup. */
  initializeComponent(
    name: string,
    element: HTMLElement,
  ): Disposable | void | null;
  /** Observe a host that has not been initialized yet. */
  observeElement(element: HTMLElement): void;
  /** Watch the container for inserted component and image targets. */
  startObserving(container: Node): void;
  /**
   * Disconnect observers, clean up delegates, and dispose tracked component
   * instances. Create a new runtime to initialize again after disposal.
   */
  dispose(): void;
}

// HTML attributes

export type HygularComponent =
  | "swiper"
  | "badge"
  | "tabview"
  | "tooltip"
  | "popover"
  | "accordion"
  | "form"
  | "alert"
  | "range";
export type HygularToggle =
  | "navbar"
  | "drawer"
  | "collapse"
  | "dropdown"
  | "popover";
export type DataBoolean = boolean | "true" | "false";
/** Presence-based flags must be omitted to disable them. */
export type DataPresence = "" | true;
export type DataNumber = number | `${number}`;
export type SkeletonLayout = "auto" | "card" | "list" | "article" | "profile";

export interface HygularAttributes {
  /** Component marker used by runtime initialization and delegated handlers. */
  "data-hygular"?: HygularComponent;
  /** Behavior activated by this trigger. */
  "data-hygular-toggle"?: HygularToggle;
  /**
   * Selector of the controlled navbar, collapse, or drawer element,
   * or the popover content source.
   * For popovers, takes precedence over data-popover-target.
   */
  "data-target"?: string;
  /** Theme selector, normally placed on the document root. */
  "data-hygular-theme"?: "light" | "dark";
  /** Dropdown: click or hover. Popover: click or manual. */
  "data-trigger"?: "click" | "hover" | "manual";
  /** Plain-text tooltip content. */
  "data-tooltip"?: string;
  /** Fallback popover body when data-content is empty or absent. */
  "data-popover"?: string;
  /** Preferred tooltip or popover placement; alignment suffixes apply to popovers. */
  "data-placement"?: PopoverPlacement;
  /** Plain-text popover body. */
  "data-content"?: string;
  /** Plain-text popover heading. */
  "data-title"?: string;
  /** Popover arrow visibility. */
  "data-arrow"?: DataBoolean;
  /** Allow outside-pointer dismissal of a popover. Default: true. */
  "data-close-outside"?: DataBoolean;
  /** Allow Escape dismissal of a popover. Default: true. */
  "data-close-escape"?: DataBoolean;
  /** Popover distance from its trigger, in pixels. Default: 10. */
  "data-offset"?: DataNumber;
  /** Initial collapse state. */
  "data-initial-open"?: DataBoolean;
  /** Current collapse state written by the runtime. */
  "data-state"?: "open" | "closed";
  /** Allow multiple accordion items to remain open. Default: false. */
  "data-allow-multiple"?: DataBoolean;
  /** Open the first accordion item during initialization. Default: false. */
  "data-open-first"?: DataBoolean;
  /** Selector of the panel controlled by this tab. */
  "data-tab"?: string;
  /** Enable the active-tab indicator with true or an empty attribute value. */
  "data-tab-indicator"?: DataBoolean | "";
  /** Badge count; values of 100 or more display as 99+. */
  "data-count"?: DataNumber;
  /** Remember alert dismissal in localStorage. Default: false. */
  "data-persistent"?: DataBoolean;
  /** Storage identifier for a persistent alert. */
  "data-dismiss-key"?: string;
  /** Delegated alert dismissal animation. Default: "fade". */
  "data-close-animation"?: DismissAnimation;
  /** Deferred image source URL. */
  "data-src"?: string;
  /** Message displayed if the deferred image fails to load. */
  "data-error-text"?: string;
  /** Space-separated rules, such as "email min:5 match:#password". */
  "data-rule"?: string;
  /** Validation message for an empty required field. */
  "data-required-msg"?: string;
  /** Validation message for a failed rule, pattern, or native constraint. */
  "data-error-msg"?: string;
  /** Custom regular expression used for field validation. */
  "data-regex"?: string;
  /** Suppress generated validation feedback when present. */
  "data-no-feedback"?: DataPresence;
  /** Submit the form through fetch when true; otherwise use native submission. */
  "data-ajax"?: DataBoolean;
  /** JSON-encoded request headers. */
  "data-ajax-headers"?: string;
  /** Request timeout in milliseconds. Default: 30000. */
  "data-ajax-timeout"?: DataNumber;
  /** Empty-state label for a custom file input group. */
  "data-default-text"?: string;
  /** Mark a loading host for Skeleton.mount() or useSkeleton(). */
  "data-skeleton"?: DataPresence;
  /** Loading layout preset. Default: "auto". */
  "data-skeleton-layout"?: SkeletonLayout;
  /** Column count for the card layout. */
  "data-skeleton-cols"?: DataNumber;
  /** Row count for card and list layouts. */
  "data-skeleton-rows"?: DataNumber;
  /** Controls Skeleton.mount(); useSkeleton() activates marked hosts directly. */
  "data-skeleton-auto"?: DataBoolean;
  /** Keep this child outside skeleton content masking. */
  "data-skeleton-ignore"?: DataPresence;
  /** Compensate a fixed element when body scrolling is locked. */
  "data-fixed-lock"?: DataPresence;
  /** Compensate a sticky element when body scrolling is locked. */
  "data-sticky-lock"?: DataPresence;
}
