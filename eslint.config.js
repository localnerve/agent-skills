// SPDX-License-Identifier: AGPL-3.0-or-later
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["out/**", "node_modules/**", ".tmp-*/**"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-process-exit": "off",
    },
  },
];
