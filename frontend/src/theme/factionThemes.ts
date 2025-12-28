export interface FactionTheme {
  primary: string        // Main faction color
  secondary: string      // Accent color
  accent: string         // Highlight/glow color
  darkBg: string         // Dark background variant
  border: string         // Border color
  glow: string           // Glow/shadow color (rgba)
  icon: string           // Faction icon emoji
  tagline: string        // Thematic quote/title
  textColor: string      // Primary text
  accentText: string     // Accent text color
}

export const FACTION_THEMES: Record<string, FactionTheme> = {
  "Space Marines": {
    primary: "#1e3a8a",        // Deep imperial blue
    secondary: "#d4af37",       // Gold trim
    accent: "#60a5fa",          // Bright blue glow
    darkBg: "#1a2a3f",          // Dark blue-gray
    border: "#3b82f6",          // Medium blue
    glow: "rgba(96, 165, 250, 0.5)",
    icon: "🛡️",
    tagline: "FOR THE EMPEROR",
    textColor: "#ffffff",
    accentText: "#d4af37"
  },
  "Chaos": {
    primary: "#7c2d12",         // Deep blood red/brown
    secondary: "#dc2626",       // Bright red
    accent: "#f87171",          // Red glow
    darkBg: "#2a1a1a",          // Very dark red-gray
    border: "#b91c1c",          // Dark red
    glow: "rgba(220, 38, 38, 0.4)",
    icon: "☠️",
    tagline: "EMBRACE CORRUPTION",
    textColor: "#fecaca",
    accentText: "#fca5a5"
  },
  "Tyranids": {
    primary: "#6b21a8",         // Deep purple
    secondary: "#a855f7",       // Bright purple
    accent: "#d8b4fe",          // Light purple glow
    darkBg: "#3a2554",          // Dark purple-gray
    border: "#9333ea",          // Purple
    glow: "rgba(168, 85, 247, 0.45)",
    icon: "🦾",
    tagline: "THE SWARM HUNGERS",
    textColor: "#e9d5ff",
    accentText: "#d8b4fe"
  },
  "Orks": {
    primary: "#3f6212",         // Deep green
    secondary: "#84cc16",       // Bright green-yellow
    accent: "#bfef45",          // Green glow
    darkBg: "#2a3a1a",          // Dark green-gray
    border: "#65a30d",          // Medium green
    glow: "rgba(132, 204, 22, 0.4)",
    icon: "⚙️",
    tagline: "WAAAGH!!!",
    textColor: "#dcfce7",
    accentText: "#bfef45"
  },
  "Necrons": {
    primary: "#164e63",         // Deep cyan-teal
    secondary: "#06b6d4",       // Bright cyan
    accent: "#22d3ee",          // Cyan glow
    darkBg: "#1a2a3f",          // Dark cyan-gray
    border: "#0891b2",          // Dark cyan
    glow: "rgba(34, 211, 238, 0.4)",
    icon: "🤖",
    tagline: "AWAKENING...",
    textColor: "#cffafe",
    accentText: "#a5f3fc"
  },
  "Astra Militarum": {
    primary: "#78350f",         // Deep brown
    secondary: "#d97706",       // Orange-brown
    accent: "#f59e0b",          // Amber glow
    darkBg: "#2a2018",          // Dark brown-gray
    border: "#b45309",          // Medium brown
    glow: "rgba(245, 158, 11, 0.35)",
    icon: "🪖",
    tagline: "FOR THE IMPERIUM",
    textColor: "#fef3c7",
    accentText: "#fcd34d"
  },
  "Eldar": {
    primary: "#3730a3",         // Deep indigo
    secondary: "#818cf8",       // Bright indigo
    accent: "#c4b5fd",          // Indigo glow
    darkBg: "#2a2340",          // Dark indigo-gray
    border: "#6366f1",          // Medium indigo
    glow: "rgba(129, 140, 248, 0.4)",
    icon: "🌟",
    tagline: "THE ANCIENT PATH",
    textColor: "#e0e7ff",
    accentText: "#c4b5fd"
  },
  "default": {
    primary: "#3d4a63",         // Light dark blue-gray
    secondary: "#5a6b82",       // Medium gray
    accent: "#7c9dd6",          // Light blue
    darkBg: "#2a3d52",          // Darker blue-gray
    border: "#4a6080",          // Medium blue-gray
    glow: "rgba(124, 157, 214, 0.4)",
    icon: "⚔️",
    tagline: "IN THE GRIM DARKNESS",
    textColor: "#d4e4f7",
    accentText: "#a0c4e8"
  }
}

export function getThemeForFaction(faction: string): FactionTheme {
  return FACTION_THEMES[faction] || FACTION_THEMES.default
}

export function getDominantFactionTheme(factions: string[]): FactionTheme {
  if (factions.length === 0) return FACTION_THEMES.default
  return getThemeForFaction(factions[0])
}

export function getThemesForAllFactions(factions: string[]): FactionTheme[] {
  return factions.map(faction => getThemeForFaction(faction))
}
