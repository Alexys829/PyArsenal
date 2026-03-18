import { createSignal } from "solid-js";
import type { CatalogEntry, InstalledTool, UpdateInfo } from "./types";

export const [catalog, setCatalog] = createSignal<CatalogEntry[]>([]);
export const [installedTools, setInstalledTools] = createSignal<Record<string, InstalledTool>>({});
export const [updates, setUpdates] = createSignal<UpdateInfo[]>([]);
export const [loading, setLoading] = createSignal(false);
export const [activeDownloads, setActiveDownloads] = createSignal<Record<string, number>>({});

// Toast notifications
export interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

export const [toasts, setToasts] = createSignal<Toast[]>([]);

let toastId = 0;

export function showToast(type: Toast["type"], message: string) {
  const id = ++toastId;
  setToasts((prev) => [...prev, { id, type, message }]);
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 5000);
}
