/*!
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */

const themeMap = {
  body: "--body",
  bodyText: "--body-text",
  primary: "--primary",
  primaryContrast: "--primary-contrast",
  font: "--font",
  fontMono: "--font-monospace",
  spaceXs: "--space-xs",
  spaceSm: "--space-sm",
  spaceMd: "--space-md",
  spaceLg: "--space-lg",
  spaceXl: "--space-xl",
  space2xl: "--space-2xl",
};

/**
 * Apply runtime theme tokens, custom classes, and font styles to the document.
 */
export function applyConfig(config = {}) {
  // Skip style injection outside the browser.
  if (typeof document === "undefined") return;

  // Skip runtime configuration when a compiled stylesheet link is present.
  if (document.querySelector('link[href*="hygular.build.css"]')) {
    return;
  }

  const CONFIG = config || {};
  if (!Object.keys(CONFIG).length) return;

  if (CONFIG.theme) {
    // Light theme overrides
    const lightVars = [];

    Object.keys(themeMap).forEach((key) => {
      if (CONFIG.theme[key]) {
        lightVars.push(`    ${themeMap[key]}: ${CONFIG.theme[key]};`);
      }
    });

    if (CONFIG.theme.extend) {
      Object.entries(CONFIG.theme.extend).forEach(([key, val]) => {
        const varName = key.startsWith("--") ? key : `--${key}`;
        lightVars.push(`    ${varName}: ${val};`);
      });
    }

    if (lightVars.length > 0) {
      injectStyles(
        `:root {\n${lightVars.join("\n")}\n}`,
        "hygular-theme-styles",
      );
    }

    // Dark theme overrides
    if (CONFIG.theme.dark) {
      const darkVars = [];

      Object.keys(themeMap).forEach((key) => {
        if (CONFIG.theme.dark[key]) {
          darkVars.push(`    ${themeMap[key]}: ${CONFIG.theme.dark[key]};`);
        }
      });

      if (CONFIG.theme.dark.extend) {
        Object.entries(CONFIG.theme.dark.extend).forEach(([key, val]) => {
          const varName = key.startsWith("--") ? key : `--${key}`;
          darkVars.push(`    ${varName}: ${val};`);
        });
      }

      if (darkVars.length > 0) {
        injectStyles(
          `[data-hygular-theme="dark"] {\n${darkVars.join("\n")}\n}`,
          "hygular-theme-dark-styles",
        );
      }
    }
  }

  if (CONFIG.classes) {
    processClasses(CONFIG.classes);
  }

  if (CONFIG.fonts && Array.isArray(CONFIG.fonts)) {
    processFonts(CONFIG.fonts);
  }
}

/**
 * Generate light and dark rules from custom class definitions.
 */
function processClasses(classes) {
  if (!classes || typeof classes !== "object" || Array.isArray(classes)) return;

  const lightRules = [];
  const darkRules = [];

  Object.entries(classes).forEach(([selector, declarations]) => {
    if (!selector || typeof selector !== "string") return;

    if (typeof declarations === "string" && declarations.trim()) {
      lightRules.push(`.${selector} { ${declarations.trim()} }`);
      return;
    }

    if (
      !declarations ||
      typeof declarations !== "object" ||
      Array.isArray(declarations)
    )
      return;

    const { dark, ...lightDecls } = declarations;

    if (Object.keys(lightDecls).length) {
      const props = Object.entries(lightDecls)
        .filter(([p, v]) => p && v !== undefined && v !== null && v !== "")
        .map(([p, v]) => `    ${p}: ${v};`)
        .join("\n");

      if (props) lightRules.push(`.${selector} {\n${props}\n}`);
    }

    if (
      dark &&
      typeof dark === "object" &&
      !Array.isArray(dark) &&
      Object.keys(dark).length
    ) {
      const darkProps = Object.entries(dark)
        .filter(([p, v]) => p && v !== undefined && v !== null && v !== "")
        .map(([p, v]) => `    ${p}: ${v};`)
        .join("\n");

      if (darkProps)
        darkRules.push(
          `[data-hygular-theme="dark"] .${selector} {\n${darkProps}\n}`,
        );
    }
  });

  const cssOutput = [...lightRules, ...darkRules].join("\n\n");
  if (cssOutput) injectStyles(cssOutput, "hygular-custom-classes");
}

/**
 * Build font utility classes and request the configured Google Fonts families.
 */
function processFonts(fonts) {
  addPreconnect("https://fonts.googleapis.com");
  addPreconnect("https://fonts.gstatic.com", true);

  const validFonts = [];
  let fontCssClasses = "";

  fonts.forEach((fontObj) => {
    if (typeof fontObj !== "object" || !fontObj.family) return;
    validFonts.push(fontObj);
    const alias =
      fontObj.alias || fontObj.family.toLowerCase().replace(/\s+/g, "-");
    const category = fontObj.category || "sans-serif";
    fontCssClasses += `.font-${alias} {\n    --hygular-font-family: "${fontObj.family}", ${category};\n    font-family: var(--hygular-font-family) !important;\n}\n`;
  });

  if (validFonts.length > 0) {
    loadGoogleFonts(validFonts);
    injectStyles(fontCssClasses, "hygular-font-classes");
  }
}

/**
 * Build the font stylesheet URL and append it if not already linked.
 */
function loadGoogleFonts(validFonts) {
  const fontQuery = validFonts
    .map((font) => {
      const cleanFamily = font.family.trim().replace(/ /g, "+");
      if (font.weights) {
        const w = font.weights.toString().replace(/,/g, ";").replace(/\s/g, "");
        return `family=${cleanFamily}:wght@${w}`;
      }
      return `family=${cleanFamily}`;
    })
    .join("&");

  const finalUrl = `https://fonts.googleapis.com/css2?${fontQuery}&display=swap`;

  if (!document.head.querySelector(`link[href="${finalUrl}"]`)) {
    const link = document.createElement("link");
    link.href = finalUrl;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
}

/**
 * Replace the style element with this ID, or create it if absent.
 */
function injectStyles(cssContent, id) {
  if (!cssContent) return;
  let styleTag = document.getElementById(id);
  if (styleTag) styleTag.remove();
  styleTag = document.createElement("style");
  styleTag.id = id;
  styleTag.textContent = cssContent;
  document.head.appendChild(styleTag);
}

/**
 * Add a preconnect link if an equivalent link is not already present.
 */
function addPreconnect(href, crossOrigin = false) {
  if (!document.head.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (crossOrigin) link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  }
}
