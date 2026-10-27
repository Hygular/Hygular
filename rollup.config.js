import terser from "@rollup/plugin-terser";
import postcss from "rollup-plugin-postcss";
import postcssPresetEnv from "postcss-preset-env";
import cssnano from "cssnano";
import copy from "rollup-plugin-copy";
import { DEFAULT_BREAKPOINTS, applyBreakpoints } from "./build/breakpoints.js";

const cdnBreakpointsPlugin = () => {
  return {
    postcssPlugin: "hygular-cdn-breakpoints",

    Once(root) {
      applyBreakpoints(root, DEFAULT_BREAKPOINTS);
    },
  };
};
cdnBreakpointsPlugin.postcss = true;

const bannerText = `/*! 
 * Hygular v1.0.0-beta.1
 * (c) Eyruz Badalzada
 * Released under the MIT License
 * https://hygular.com
 */`;

const stripCssCommentsPlugin = () => {
  return {
    postcssPlugin: "strip-css-comments",
    OnceExit(root) {
      root.walkComments((comment) => {
        comment.remove();
      });
      root.prepend(bannerText);
    },
  };
};
stripCssCommentsPlugin.postcss = true;

// Omit JavaScript chunks from CSS-only builds.
const cssOnlyOutputPlugin = () => ({
  name: "css-only-output",

  generateBundle(_options, bundle) {
    for (const [fileName, output] of Object.entries(bundle)) {
      if (output.type === "chunk") {
        delete bundle[fileName];
      }
    }
  },
});

export default [
  // Shared ESM chunks keep core state identical across both entry points.
  {
    input: {
      "js/hygular.esm": "src/js/index.js",
      "react/hygular-react.esm": "src/react/index.js",
    },
    external: ["react"],
    output: {
      dir: "dist",
      entryFileNames: "[name].js",
      chunkFileNames: "js/shared/[name]-[hash].js",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      terser({
        compress: false,
        mangle: false,
        format: {
          beautify: true,
          comments: false,
          preamble: bannerText,
        },
      }),
      copy({
        targets: [
          {
            src: "src/react/index.d.ts",
            dest: "dist/react",
            rename: "index.d.ts",
          },
        ],
      }),
    ],
  },

  // UMD bundle exposed as window.Hygular in browsers.
  {
    input: "src/js/index.umd.js",
    output: {
      file: "dist/js/hygular.min.js",
      format: "umd",
      name: "Hygular",
      sourcemap: true,
      plugins: [
        terser({
          format: {
            comments: false,
            preamble: bannerText,
          },
        }),
      ],
    },
  },

  // Unminified stylesheet used as input by the JIT compiler.
  {
    input: "src/css/hygular.css",
    output: {
      dir: "dist/css",
    },
    plugins: [
      postcss({
        extract: "hygular.css",
        minimize: false,
        plugins: [
          stripCssCommentsPlugin(),
          postcssPresetEnv({
            stage: false,
          }),
        ],
      }),
      cssOnlyOutputPlugin(),
    ],
  },

  // Minified stylesheet with resolved breakpoint values.
  {
    input: "src/css/hygular.css",
    output: {
      dir: "dist/css",
    },
    plugins: [
      postcss({
        extract: "hygular.min.css",
        minimize: false,
        plugins: [
          cdnBreakpointsPlugin(),
          postcssPresetEnv({
            stage: false,
          }),
          cssnano({
            preset: ["default", { calc: false }],
          }),
        ],
      }),
      cssOnlyOutputPlugin(),
    ],
  },
];
