import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the build works at any address, including a
  // GitHub Pages project path such as /shelf-and-screen/.
  base: "./",
  plugins: [react()],
  server: { port: 5173, strictPort: false },
});
