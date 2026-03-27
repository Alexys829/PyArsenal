import { Show } from "solid-js";
import { updates } from "../lib/stores";

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  showManage: boolean;
}

export default function Sidebar(props: SidebarProps) {
  const updateCount = () => updates().length;

  return (
    <nav class="sidebar">
      <div class="sidebar-logo">
        <h1>PyArsenal</h1>
      </div>
      <ul class="sidebar-nav">
        <li
          class={props.activePage === "store" ? "active" : ""}
          onClick={() => props.onNavigate("store")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M4 4h16v2H4V4zm0 4h16v12H4V8zm2 2v8h12v-8H6z" />
          </svg>
          <span>Store</span>
        </li>
        <li
          class={props.activePage === "library" ? "active" : ""}
          onClick={() => props.onNavigate("library")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
          </svg>
          <span>Library</span>
          {updateCount() > 0 && (
            <span class="badge">{updateCount()}</span>
          )}
        </li>
        <li
          class={props.activePage === "downloads" ? "active" : ""}
          onClick={() => props.onNavigate("downloads")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
          <span>Downloads</span>
        </li>
        <Show when={props.showManage}>
          <li
            class={props.activePage === "addtool" ? "active" : ""}
            onClick={() => props.onNavigate("addtool")}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
            <span>Manage Catalog</span>
          </li>
        </Show>
        <li
          class={props.activePage === "stats" ? "active" : ""}
          onClick={() => props.onNavigate("stats")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
          </svg>
          <span>Statistics</span>
        </li>
        <li
          class={props.activePage === "themes" ? "active" : ""}
          onClick={() => props.onNavigate("themes")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
          <span>Themes</span>
        </li>
        <li
          class={props.activePage === "about" ? "active" : ""}
          onClick={() => props.onNavigate("about")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
          <span>About</span>
        </li>
        <li
          class={props.activePage === "settings" ? "active" : ""}
          onClick={() => props.onNavigate("settings")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z" />
          </svg>
          <span>Settings</span>
        </li>
      </ul>
      <div class="sidebar-footer">
        <span class="version">v0.5.0</span>
      </div>
    </nav>
  );
}
