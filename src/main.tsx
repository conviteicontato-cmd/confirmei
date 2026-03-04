import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

declare global {
  interface Window {
    __LOVABLE_DOM_GUARD_INSTALLED__?: boolean;
  }
}

const installDomRemoveChildGuard = () => {
  if (typeof window === "undefined" || window.__LOVABLE_DOM_GUARD_INSTALLED__) {
    return;
  }

  window.__LOVABLE_DOM_GUARD_INSTALLED__ = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (!child || child.parentNode !== this) {
      console.error("[DOMGuard] removeChild prevented (node não é filho do parent)", {
        path: window.location.pathname,
        child,
        parent: this,
        stack: new Error().stack,
      });
      return child;
    }

    return originalRemoveChild.call(this, child) as T;
  };
};

installDomRemoveChildGuard();

createRoot(document.getElementById("root")!).render(<App />);

