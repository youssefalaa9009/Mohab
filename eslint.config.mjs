import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "drizzle/**",
      "node_modules/**",
      ".logs/**",
      ".postgres/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
    },
  },

  // Browser/shared code.
  {
    files: ["src/**/*.{ts,tsx}"],
    // `configs.flat.*` are the flat-config variants; `configs.recommended` is eslintrc-shaped.
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Hard boundary: anything under server/ may hold secrets or database access
      // and must never reach the browser bundle.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/*", "**/server/**", "../../server/*"],
              message:
                "src/ must not import from server/. Call the Fastify API instead so the code stays isomorphic.",
            },
            {
              group: ["node:*", "fastify", "postgres", "drizzle-orm/postgres-js"],
              message: "Node-only module: this would break the browser build.",
            },
          ],
        },
      ],
    },
  },

  // Node code.
  {
    files: ["server/**/*.{ts,tsx}", "scripts/**/*.ts", "*.config.{ts,mjs}"],
    languageOptions: { globals: globals.node },
    rules: { "no-console": "off" },
  },
);
