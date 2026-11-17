import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Hub from "./hub";
import "./tokens.css";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Hub />
  </StrictMode>,
);
