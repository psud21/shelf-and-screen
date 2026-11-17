import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Hub from "./hub";
import "./tokens.css";
import "./globals.css";

// Mark images once loaded so artwork fades in instead of popping (see
// placeholders.css). Images that are already complete, such as cached ones, are
// marked as soon as they appear, so none can be left invisible.
const markLoaded = (image: HTMLImageElement) => image.classList.add("is-loaded");
document.addEventListener(
  "load",
  (event) => {
    if (event.target instanceof HTMLImageElement) markLoaded(event.target);
  },
  true,
);
new MutationObserver((changes) => {
  for (const change of changes) {
    const nodes = change.type === "attributes" ? [change.target] : Array.from(change.addedNodes);
    for (const node of nodes) {
      if (!(node instanceof Element)) continue;
      const images = node instanceof HTMLImageElement ? [node] : node.querySelectorAll("img");
      for (const image of images) {
        if (change.type === "attributes") image.classList.remove("is-loaded");
        if (image.complete && image.naturalWidth > 0) markLoaded(image);
      }
    }
  }
}).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src"],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Hub />
  </StrictMode>,
);
