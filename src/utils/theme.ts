export const colors = {
	bg: "#0A0A0A",
	surface: "#141414",
	surfaceAlt: "#1C1C1C",
	border: "#2A2A2A",
	accent: "#E8FF47", // electric lime — the one pop of color
	accentDim: "#B8CC30",
	textPrimary: "#F0F0F0",
	textSecondary: "#777777",
	textMuted: "#444444",
	success: "#4ADE80",
	danger: "#FF4444",
	morning: "#FFB347", // warm orange for morning items
	daily: "#7EB8F7", // cool blue for daily items
};

export const font = {
	mono: Platform.OS === "ios" ? "Courier New" : "monospace",
	sans: Platform.OS === "ios" ? "System" : "sans-serif",
};

export const radius = {
	sm: 6,
	md: 12,
	lg: 20,
};

export const spacing = {
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
};

import { Platform } from "react-native";
