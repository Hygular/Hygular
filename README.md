# Hygular

**Independent Frontend UI Engine**

Hygular combines semantic utility CSS, reusable component styles, and a lightweight JavaScript runtime. Use utilities for layout, component styles for common interface patterns, and data attributes or JavaScript APIs for interactive behavior.

Use the CSS on its own, initialize the vanilla runtime, or manage individual components through React hooks. The core browser runtime has no third-party JavaScript dependencies. React integration is optional, and the CSS compiler is distributed separately.

[Documentation](https://hygular.com/docs) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [MIT License](LICENSE)

## What is included

- **CSS:** theme tokens, utilities, responsive styles, and component styles organized into `theme`, `base`, `components`, and `utilities` cascade layers.
- **JavaScript:** delegated interactions, initialization and observation of supported markup, and programmatic component APIs.
- **React:** hooks exported from `@hygular/core/react`, with TypeScript declarations. React is optional for the core package.
- **Distribution:** ES module and UMD JavaScript bundles, source maps, and minified CSS for direct use.
- **Optional compiler:** `@hygular/cli` scans source files and builds a stylesheet from the CSS your project uses, its required dependencies, and configured additions.

## Installation

Hygular is currently in beta. The examples below use `@hygular/core@1.0.0-beta.1`. APIs may change before the first stable release.

```sh
npm install @hygular/core@1.0.0-beta.1
```

### With a bundler

Import the stylesheet in your application entry point:

```js
import "@hygular/core/css";
```

For a vanilla application, initialize the runtime once in a browser entry point, after the page markup is available:

```js
import "@hygular/core/css";
import { Hygular } from "@hygular/core";

new Hygular();
```

CSS utilities and static component styles do not require runtime initialization:

```html
<div class="is-flex gap-3">
  <button type="button" class="button is-primary">Save changes</button>
  <button type="button" class="button">Cancel</button>
</div>
```

Component-specific markup and behavior are covered in the [documentation](https://hygular.com/docs).

### With a CDN

Add the stylesheet to the document head:

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@hygular/core@1.0.0-beta.1/dist/css/hygular.min.css"
/>
```

Place the scripts after your page content, before `</body>`:

```html
<script src="https://cdn.jsdelivr.net/npm/@hygular/core@1.0.0-beta.1/dist/js/hygular.min.js"></script>
<script>
  new Hygular();
</script>
```

The UMD bundle exposes `Hygular` on `window`. Omit both scripts when you only need CSS.

## Package entry points

| Entry point | Purpose |
| --- | --- |
| `@hygular/core` | JavaScript runtime and public component APIs |
| `@hygular/core/react` | React hooks and their TypeScript declarations |
| `@hygular/core/css` | Minified stylesheet for direct use |
| `@hygular/core/css/source` | Unminified stylesheet for the CSS compiler |

The CSS paths are package exports. `@hygular/core/css/source` resolves to `dist/css/hygular.css`; it is not a separate source directory.

## Components

| Area | Components and behaviors |
| --- | --- |
| Navigation and disclosure | Navbar, Drawer, Dropdown, Collapse, Accordion, Tabview |
| Overlays and feedback | Modal, Toast, Tooltip, Popover, Alert |
| Forms and inputs | Form, Select, Range |
| Content and loading | Carousel, Swiper, Badge, Skeleton, LazyImage |
| Appearance | DarkMode |

The runtime initializes supported declarative components and binds delegated interactions. Components with public JavaScript exports can also be imported directly:

```js
import { Modal, Toast, Carousel, Range } from "@hygular/core";
```

Importing a component does not create an instance. Use its documented constructor or helper methods, and dispose of instances when they are no longer needed.

## React and server rendering

React hooks are available through the `@hygular/core/react` entry point of the same package. They connect component behavior to effects and refs; no Hygular provider is required.

```tsx
"use client";

import { useRange } from "@hygular/core/react";

export default function VolumeControl() {
  const { ref, value } = useRange();

  return (
    <div>
      <label htmlFor="volume">Volume</label>
      <div ref={ref} className="group-range">
        <input
          id="volume"
          className="form-range"
          type="range"
          min="0"
          max="100"
          defaultValue="50"
        />
      </div>
      <output htmlFor="volume">{String(value ?? 50)}</output>
    </div>
  );
}
```

Import `@hygular/core/css` once at the global stylesheet entry allowed by your application framework. In a Next.js App Router application, that can be the root layout.

Hygular's styles and markup can be used in server-rendered pages. Interactive behavior needs a browser DOM: initialize it after the markup is mounted, and keep hook-based components inside a client boundary where your framework requires one. The React hooks perform their DOM setup in effects, which do not run during server rendering.

Do not initialize the same element through both a React hook and a separate manual setup. Choose the integration that owns its lifecycle.

## Optional CSS compiler

Install the CLI only when you want source scanning and a project-specific stylesheet:

```sh
npm install -D @hygular/cli@1.0.0-beta.1
```

The CLI requires Node.js 20.19.0 or later. Its parser, compiler, and watcher dependencies stay in the CLI package; installing `@hygular/core` alone does not install them.

Create `hygular.config.js` at the project root. This example uses ES module syntax:

```js
export default {
  theme: {
    primary: "#2563eb",
  },
  jit: {
    scan: ["./src", "./app", "./components", "./pages"],
    safelist: ["button", "is-primary"],
  },
};
```

Keep the scan paths that match your project, then build:

```sh
npx hygular build
```

The default output is `public/hygular.build.css`. Load that generated stylesheet in place of the full `@hygular/core/css` stylesheet.

To rebuild when watched files change:

```sh
npx hygular dev
```

Use a CLI release that supports `@hygular/core`. The compiler uses the unminified stylesheet exposed by `@hygular/core/css/source` as its input; this entry is intended for compilation rather than direct browser use.

Use complete class names in source expressions:

```jsx
<div className={active ? "bg-primary" : "bg-surface"} />
```

The scanner can collect both alternatives. It cannot infer arbitrary runtime values in expressions such as `` `bg-${color}` ``. List the complete alternatives in source or include them in `jit.safelist`.

## Themes and breakpoints

The CSS includes an OKLCH palette, shared design tokens, logical properties, and dark-theme variables. Reuse those tokens when extending components, and check contrast and layout in the themes you support.

For a vanilla runtime setup, theme options can be supplied during initialization:

```js
new Hygular({
  theme: {
    primary: "#6366f1",
  },
});
```

This configures the browser runtime. When using the compiler, define theme options in `hygular.config.js` and rebuild the stylesheet. Runtime style injection is skipped when the page contains a stylesheet link whose URL includes `hygular.build.css`.

The default breakpoint values are:

| Prefix | Width |
| --- | --- |
| `sm` | `640px` |
| `md` | `864px` |
| `lg` | `1120px` |
| `xl` | `1408px` |
| `2xl` | `1792px` |

To override the existing breakpoint aliases in CLI output:

```js
export default {
  theme: {
    breakpoints: {
      md: "900px",
      lg: "1200px",
    },
  },
  jit: {
    scan: ["./src"],
  },
};
```

Rebuild the stylesheet after changing these values. The prebuilt CSS uses the defaults; runtime CSS variable changes do not rewrite its compiled media queries.

## Browser support

Hygular targets modern browsers. The CSS uses features such as cascade layers, custom properties, OKLCH colors, logical properties, and selectors including `:has()` and `:user-invalid`. Interactive components also use modern DOM APIs, including `IntersectionObserver` and `MutationObserver` where needed.

Check the components you use in your target browsers, including keyboard navigation, focus handling, and responsive layouts.

## Contributing

Bug reports, documentation corrections, accessibility improvements, and focused code changes are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and review guidance.

For a bug report, include the Hygular version, browser, expected behavior, and a small reproduction. Include the CLI version and configuration when reporting generated CSS issues.

## About the name

Hygular is an invented name inspired by the Danish word *hygge*. It reflects the project's aim: styling, components, and behavior that fit comfortably together.

## License

[MIT](LICENSE) © Eyruz Badalzada
