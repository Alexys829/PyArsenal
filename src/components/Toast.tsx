import { For } from "solid-js";
import { toasts, setToasts } from "../lib/stores";

export default function ToastContainer() {
  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div class="toast-container">
      <For each={toasts()}>
        {(toast) => (
          <div class={`toast toast-${toast.type}`} onClick={() => dismiss(toast.id)}>
            <span class="toast-icon">
              {toast.type === "success" ? "\u2713" : toast.type === "error" ? "\u2717" : "\u2139"}
            </span>
            <span class="toast-message">{toast.message}</span>
          </div>
        )}
      </For>
    </div>
  );
}
