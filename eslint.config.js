export default [
  {
    files: ["**/*.js"],
    rules: {
      "no-unused-vars": "error",
      "no-undef": "error",
      semi: ["error", "always"],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // Kenalkan variabel bawaan browser ke aturan no-undef untuk kode aplikasi.
    files: ["script.js", "config.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        document: "readonly",
        window: "readonly",
      },
    },
  },
];
