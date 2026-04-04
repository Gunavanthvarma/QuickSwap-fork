import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: false,
    setupNodeEvents(_on, _config) {
      // implement node event listeners here
    },
  },
  allowCypressEnv: false,
});
