import typescript from "@rollup/plugin-typescript";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

const watch = process.env.ROLLUP_WATCH === "true";

export default {
  input: "src/main.ts",
  output: {
    dir: ".",
    sourcemap: watch ? "inline" : false,
    format: "cjs",
    exports: "default",
    inlineDynamicImports: true,
  },
  external: ["obsidian", "electron"],
  plugins: [
    typescript({
      compilerOptions: {
        inlineSourceMap: false,
        inlineSources: watch,
        sourceMap: watch,
      },
    }),
    nodeResolve({ browser: false }),
    commonjs(),
    json(),
  ],
};
