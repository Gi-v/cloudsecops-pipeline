import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // eslint-plugin-react-hooks v7's "recommended" config folds in the
      // full React Compiler diagnostic set (set-state-in-effect, refs,
      // purity, immutability, ...), which flags this codebase's
      // pre-compiler idioms — mirroring the latest prop into a ref to dodge
      // stale closures in a callback, kicking off an initial fetch from a
      // mount-only effect — as errors even though they're correct, standard
      // React and not bugs. Opting into those rules would mean adopting the
      // React Compiler and rewriting working hook logic to match its
      // constraints, which is a separate, larger change than a dependency
      // upgrade. Keep just the two rules every React codebase has linted
      // against for years.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
