export interface PresetTheme {
  id: string;
  name: string;
  colors: Record<string, string>;
}

export const COLOR_LABELS: Record<string, string> = {
  "bg-dark": "Background",
  "bg-card": "Card",
  "bg-card-hover": "Card Hover",
  "bg-sidebar": "Sidebar",
  accent: "Accent",
  "accent-hover": "Accent Hover",
  text: "Text",
  "text-muted": "Text Muted",
  success: "Success",
  warning: "Warning",
  danger: "Danger",
  "icon-gradient-start": "Icon Gradient Start",
  "icon-gradient-end": "Icon Gradient End",
};

export const PRESET_THEMES: PresetTheme[] = [
  {
    id: "steam-dark",
    name: "Steam Dark",
    colors: {
      "bg-dark": "#1b2838",
      "bg-card": "#2a475e",
      "bg-card-hover": "#334d6e",
      "bg-sidebar": "#171a21",
      accent: "#66c0f4",
      "accent-hover": "#4fa8d8",
      text: "#c7d5e0",
      "text-muted": "#8f98a0",
      success: "#5ba32b",
      warning: "#e8a427",
      danger: "#c44040",
      "icon-gradient-start": "#66c0f4",
      "icon-gradient-end": "#4a9eda",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      "bg-dark": "#0d1117",
      "bg-card": "#161b22",
      "bg-card-hover": "#1c2333",
      "bg-sidebar": "#010409",
      accent: "#58a6ff",
      "accent-hover": "#388bfd",
      text: "#e6edf3",
      "text-muted": "#8b949e",
      success: "#3fb950",
      warning: "#d29922",
      danger: "#f85149",
      "icon-gradient-start": "#58a6ff",
      "icon-gradient-end": "#388bfd",
    },
  },
  {
    id: "nord",
    name: "Nord",
    colors: {
      "bg-dark": "#2e3440",
      "bg-card": "#3b4252",
      "bg-card-hover": "#434c5e",
      "bg-sidebar": "#272c36",
      accent: "#88c0d0",
      "accent-hover": "#81a1c1",
      text: "#eceff4",
      "text-muted": "#a0a8b7",
      success: "#a3be8c",
      warning: "#ebcb8b",
      danger: "#bf616a",
      "icon-gradient-start": "#88c0d0",
      "icon-gradient-end": "#5e81ac",
    },
  },
  {
    id: "monokai",
    name: "Monokai",
    colors: {
      "bg-dark": "#272822",
      "bg-card": "#3e3d32",
      "bg-card-hover": "#49483e",
      "bg-sidebar": "#1e1f1c",
      accent: "#66d9ef",
      "accent-hover": "#52b8cc",
      text: "#f8f8f2",
      "text-muted": "#a6a699",
      success: "#a6e22e",
      warning: "#e6db74",
      danger: "#f92672",
      "icon-gradient-start": "#66d9ef",
      "icon-gradient-end": "#a6e22e",
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    colors: {
      "bg-dark": "#282a36",
      "bg-card": "#343746",
      "bg-card-hover": "#3e4154",
      "bg-sidebar": "#21222c",
      accent: "#bd93f9",
      "accent-hover": "#a678e0",
      text: "#f8f8f2",
      "text-muted": "#a0a4b8",
      success: "#50fa7b",
      warning: "#f1fa8c",
      danger: "#ff5555",
      "icon-gradient-start": "#bd93f9",
      "icon-gradient-end": "#ff79c6",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    colors: {
      "bg-dark": "#002b36",
      "bg-card": "#073642",
      "bg-card-hover": "#0a4050",
      "bg-sidebar": "#001f27",
      accent: "#268bd2",
      "accent-hover": "#1a6fa0",
      text: "#eee8d5",
      "text-muted": "#93a1a1",
      success: "#859900",
      warning: "#b58900",
      danger: "#dc322f",
      "icon-gradient-start": "#268bd2",
      "icon-gradient-end": "#2aa198",
    },
  },
  {
    id: "light",
    name: "Light",
    colors: {
      "bg-dark": "#f0f2f5",
      "bg-card": "#ffffff",
      "bg-card-hover": "#f5f7fa",
      "bg-sidebar": "#e4e7ec",
      accent: "#2563eb",
      "accent-hover": "#1d4ed8",
      text: "#1f2937",
      "text-muted": "#6b7280",
      success: "#16a34a",
      warning: "#d97706",
      danger: "#dc2626",
      "icon-gradient-start": "#2563eb",
      "icon-gradient-end": "#7c3aed",
    },
  },
  {
    id: "catppuccin",
    name: "Catppuccin Mocha",
    colors: {
      "bg-dark": "#1e1e2e",
      "bg-card": "#313244",
      "bg-card-hover": "#3b3c52",
      "bg-sidebar": "#181825",
      accent: "#89b4fa",
      "accent-hover": "#74a8f7",
      text: "#cdd6f4",
      "text-muted": "#a6adc8",
      success: "#a6e3a1",
      warning: "#f9e2af",
      danger: "#f38ba8",
      "icon-gradient-start": "#89b4fa",
      "icon-gradient-end": "#cba6f7",
    },
  },
];

export function applyTheme(colors: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${key}`, value);
  }
}

export function getPresetById(id: string): PresetTheme | undefined {
  return PRESET_THEMES.find((t) => t.id === id);
}
