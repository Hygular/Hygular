# Changelog

Notable changes to Hygular are recorded here.

## [1.0.0-beta.2] - 2026-11-02

### Fixed

- Share delegated handlers across runtime instances and React hooks to prevent duplicate interactions, requests, and events.
- Release drawer scroll locks on removal and wait for panel transitions before opening another drawer.
- Cancel pending animations, timers, and listeners when the last subscriber disconnects.
- Prevent stale form requests from updating a new submission; abort requests when their forms are removed.
- Respect canceled form submissions and make `hygular.form.start` cancelable.
- Initialize newly inserted markup without resetting existing component state.
- Preserve active drawers and pending requests during runtime reinitialization.

### Tests

- Add coverage for shared subscriptions, React StrictMode, cleanup, request cancellation, and drawer transitions.

## [1.0.0-beta.1] - 2026-10-29

Initial public beta, published as `@hygular/core`.

### Added

- Semantic utility CSS and component styles organized into `theme`, `base`, `components`, and `utilities` cascade layers.
- Design tokens, light and dark themes, and responsive utilities.
- A dependency-free JavaScript runtime with declarative data attributes and programmatic component APIs.
- Optional React hooks through `@hygular/core/react`.
- TypeScript declarations for the core API and React hooks.
- ES module and UMD JavaScript bundles with source maps.
- Minified CSS for direct use and an unminified stylesheet for the separate CSS compiler.

This is a prerelease. APIs may change before the first stable release.