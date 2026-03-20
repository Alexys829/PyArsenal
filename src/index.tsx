/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";

// Disable browser context menu (right-click)
document.addEventListener("contextmenu", (e) => e.preventDefault());

render(() => <App />, document.getElementById("root") as HTMLElement);
