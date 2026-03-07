/**
 * Runtime design tokens for JavaScript-only contexts.
 *
 * Use these ONLY where NativeWind className is unavailable:
 *   - Navigation header styles (headerStyle, headerTintColor)
 *   - ActivityIndicator color prop
 *   - SVG fills and strokes (charts, gauges)
 *   - StatusBar barStyle
 *
 * For all other UI, use Tailwind utility classes via className.
 */

import { useColorScheme } from "react-native";

type TokenSet = {
  background: { primary: string; secondary: string; tertiary: string; inverse: string };
  surface: { default: string; raised: string; sunken: string };
  text: {
    primary: string; secondary: string; tertiary: string; disabled: string;
    inverse: string; brand: string; success: string; warning: string; error: string;
  };
  border: { default: string; strong: string; focus: string; error: string };
  brand: { subtle: string; muted: string; default: string; hover: string; active: string; text: string };
  status: {
    success: { subtle: string; muted: string; default: string; text: string };
    warning: { subtle: string; muted: string; default: string; text: string };
    error: { subtle: string; muted: string; default: string; text: string };
    info: { subtle: string; muted: string; default: string; text: string };
  };
  money: { positive: string; negative: string; pending: string };
  ai: { bubble: { assistant: string; user: string }; avatar: { bg: string; icon: string } };
  score: { poor: string; fair: string; good: string; excellent: string };
  overlay: string;
};

const light = {
  background: {
    primary: "#FFFFFF",
    secondary: "#F8FAFC",
    tertiary: "#F1F5F9",
    inverse: "#0F172A",
  },
  surface: {
    default: "#FFFFFF",
    raised: "#FFFFFF",
    sunken: "#F8FAFC",
  },
  text: {
    primary: "#0F172A",
    secondary: "#334155",
    tertiary: "#64748B",
    disabled: "#CBD5E1",
    inverse: "#FFFFFF",
    brand: "#0284C7",
    success: "#059669",
    warning: "#A16207",
    error: "#E11D48",
  },
  border: {
    default: "#E2E8F0",
    strong: "#CBD5E1",
    focus: "#0EA5E9",
    error: "#F43F5E",
  },
  brand: {
    subtle: "#F0F9FF",
    muted: "#E0F2FE",
    default: "#0EA5E9",
    hover: "#0284C7",
    active: "#0369A1",
    text: "#0369A1",
  },
  status: {
    success: { subtle: "#ECFDF5", muted: "#D1FAE5", default: "#10B981", text: "#047857" },
    warning: { subtle: "#FEFCE8", muted: "#FEF9C3", default: "#EAB308", text: "#854D0E" },
    error: { subtle: "#FFF1F2", muted: "#FFE4E6", default: "#F43F5E", text: "#BE123C" },
    info: { subtle: "#EFF6FF", muted: "#DBEAFE", default: "#3B82F6", text: "#1D4ED8" },
  },
  money: {
    positive: "#059669",
    negative: "#0F172A",
    pending: "#CA8A04",
  },
  ai: {
    bubble: { assistant: "#F0F9FF", user: "#0EA5E9" },
    avatar: { bg: "#E0E7FF", icon: "#818CF8" },
  },
  score: {
    poor: "#F43F5E",
    fair: "#F97316",
    good: "#EAB308",
    excellent: "#10B981",
  },
  overlay: "rgba(0, 0, 0, 0.5)",
} as const satisfies TokenSet;

const dark = {
  background: {
    primary: "#000000",
    secondary: "#0F172A",
    tertiary: "#1F2937",
    inverse: "#F8FAFC",
  },
  surface: {
    default: "#0F172A",
    raised: "#1F2937",
    sunken: "#000000",
  },
  text: {
    primary: "#F8FAFC",
    secondary: "#E2E8F0",
    tertiary: "#94A3B8",
    disabled: "#4B5563",
    inverse: "#0F172A",
    brand: "#38BDF8",
    success: "#34D399",
    warning: "#FACC15",
    error: "#FB7185",
  },
  border: {
    default: "#334155",
    strong: "#4B5563",
    focus: "#38BDF8",
    error: "#FB7185",
  },
  brand: {
    subtle: "#0C4A6E",
    muted: "#075985",
    default: "#38BDF8",
    hover: "#7DD3FC",
    active: "#BAE6FD",
    text: "#7DD3FC",
  },
  status: {
    success: { subtle: "#064E3B", muted: "#065F46", default: "#34D399", text: "#6EE7B7" },
    warning: { subtle: "#713F12", muted: "#854D0E", default: "#FACC15", text: "#FDE047" },
    error: { subtle: "#881337", muted: "#9F1239", default: "#FB7185", text: "#FDA4AF" },
    info: { subtle: "#1E3A8A", muted: "#1E40AF", default: "#60A5FA", text: "#93C5FD" },
  },
  money: {
    positive: "#34D399",
    negative: "#F8FAFC",
    pending: "#FACC15",
  },
  ai: {
    bubble: { assistant: "#0C4A6E", user: "#38BDF8" },
    avatar: { bg: "#3730A3", icon: "#A5B4FC" },
  },
  score: {
    poor: "#FB7185",
    fair: "#FB923C",
    good: "#FACC15",
    excellent: "#34D399",
  },
  overlay: "rgba(0, 0, 0, 0.65)",
} as const satisfies TokenSet;

export const tokens = { light, dark };

/** Returns the token set matching the current system color scheme. */
export function useTokens() {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
