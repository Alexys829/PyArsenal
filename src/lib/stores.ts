import { createSignal } from "solid-js";
import type { CatalogEntry, InstalledTool, UpdateInfo, DownloadProgress } from "./types";

export const [catalog, setCatalog] = createSignal<CatalogEntry[]>([]);
export const [installedTools, setInstalledTools] = createSignal<Record<string, InstalledTool>>({});
export const [updates, setUpdates] = createSignal<UpdateInfo[]>([]);
export const [loading, setLoading] = createSignal(false);
export const [activeDownloads, setActiveDownloads] = createSignal<Record<string, DownloadProgress>>({});
export const [favorites, setFavorites] = createSignal<string[]>([]);
export const [launchCounts, setLaunchCounts] = createSignal<Record<string, number>>({});

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

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
