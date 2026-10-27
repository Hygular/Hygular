# Contributing to Hygular

Contributions to Hygular are welcome, including bug reports, documentation corrections, accessibility improvements, and focused code changes.

For a new component, a public API change, or a substantial architectural change, open an issue first so the scope can be agreed before implementation.

## Design principles

Hygular brings semantic utility CSS, reusable components, and a lightweight JavaScript runtime together. Changes should keep those parts consistent.

- Use CSS for styling, layout, and states it can express reliably. Use JavaScript for behavior that needs it.
- Keep the core browser runtime free of third-party runtime dependencies. Build tools belong in development dependencies; compiler dependencies belong in the CLI package.
- Follow the existing component lifecycle and event handling. Both declarative initialization and programmatic APIs are supported; preserve the behavior of each where implemented.
- Keep React optional. React-specific code belongs in the adapter, not in the vanilla runtime.
- Reuse existing theme tokens and CSS layers. Prefer logical properties where appropriate, and check RTL behavior rather than assuming it follows automatically.
- Treat keyboard access, focus management, accessible names, and reduced-motion behavior as part of component behavior.
- Keep public names consistent across JavaScript, data attributes, CSS, TypeScript declarations, and examples.

## Local setup

Fork the repository, clone your fork, and open its root directory. Install dependencies and build the framework:

```sh
npm install
npm run build
```

To rebuild the distributable files as source files change:

```sh
npm run build:watch
```

The build commands use Rollup. Watch mode rebuilds files; it does not start a web server. Use a local page or the relevant example to exercise changes in a browser.

## Source layout

| Path | Purpose |
| --- | --- |
| `src/css/` | Theme tokens, base styles, components, and utilities |
| `src/js/` | Vanilla JavaScript runtime, components, and helpers |
| `src/react/` | React integration and its TypeScript declarations |
| `index.d.ts` | Core TypeScript declarations |
| `build/` | Framework build helpers, including breakpoint handling |
| `rollup.config.js` | JavaScript and CSS bundle configuration |
| `dist/` | Generated distribution files |

Make changes in the source files, then rebuild. Do not fix generated files in `dist/` directly.

The optional `@hygular/cli` package is developed and versioned separately. Compiler, scanning, cache, and watch changes belong there. The framework build must not import CLI internals. Changes to `hygular/css/source` or default breakpoint values need a compatibility check with the CLI.

## Making changes

Keep each pull request focused on one problem. Follow the surrounding code style and keep comments brief: explain constraints or non-obvious decisions rather than restating the code.

For JavaScript changes:

- Reuse the existing lifecycle, registration, and event utilities where appropriate.
- Clean up listeners, observers, timers, and temporary DOM changes when a component is destroyed.
- Check repeated initialization and interactions between multiple instances.
- Keep imports safe in environments without a DOM where the API supports that use.
- Update TypeScript declarations and React bindings when the affected public API changes.

For CSS changes:

- Place rules in the appropriate layer and reuse existing tokens.
- Check responsive behavior, relevant themes, and RTL layouts.
- Check component states together with the JavaScript that controls them.
- When changing selectors, tokens, or media-query structure, check that the separate CLI still retains the required CSS.

## Checking your work

Run `npm run build` before submitting a pull request. A successful build is a baseline; it does not replace behavior checks.

Use checks appropriate to the change:

- Reproduce the original bug and verify the fix with a small example.
- Exercise affected interactions in Chrome or Edge and Firefox. Include Safari when the change involves browser-specific behavior or you have access to it.
- For interactive components, check keyboard navigation, focus restoration, and open/close or show/dismiss behavior as applicable.
- For responsive styles, check both sides of each affected breakpoint.
- For React changes, check mounting, updates, unmounting, and repeated effects in Strict Mode.
- For type changes, compile a small usage example against the declarations.
- Add or update a focused regression test where a suitable test suite exists.

In the pull request, state what you tested and any environment you could not check. Do not describe untested behavior as verified.

## Pull requests

Create a branch from the repository's default branch and use a descriptive name, such as `fix/modal-focus` or `docs/react-usage`.

Use clear commit messages. Conventional Commits are preferred:

```text
fix: restore focus after closing a modal
feat: add a component option
docs: clarify React setup
```

Explain the problem, the change, and its effect on users. Include reproduction steps for a bug fix and screenshots or a small demo when they help explain a visual change. Call out public API changes and any migration needed.

Add a concise entry under `[Unreleased]` in `CHANGELOG.md` for user-facing changes. Internal cleanup usually does not need an entry. Leave release dates and version headings to the release process.

## Bug reports

Include:

- The Hygular version and how you load it: a package import, a browser bundle, or the React integration.
- Expected and actual behavior.
- The smallest code example that reproduces the issue.
- Browser, operating system, and relevant build-tool versions.
- Console errors or build output, if present.

For CLI issues, also include the CLI version, relevant configuration, and source classes that produce the unexpected CSS. Remove secrets and private data before sharing a reproduction.

## License

Contributions to Hygular are provided under the project's MIT License. Only submit code and assets you have the right to contribute.
