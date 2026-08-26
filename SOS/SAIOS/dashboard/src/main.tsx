import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./design-system/tokens.css";
import "./design-system/components.css";
import "./design-system/library.css";
import "./styles/global.css";
import "./views/mission-control/mission-control.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
