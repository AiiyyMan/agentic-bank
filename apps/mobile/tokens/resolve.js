/**
 * Token resolver — transforms W3C DTCG tokens into flat Tailwind-compatible objects.
 * Resolves {alias} references against primitives.
 */

const primitives = require("./primitives.json");
const semantic = require("./semantic.json");

// Flatten a nested token object into dot-path entries: { "gray.0": "#FFFFFF", ... }
function flattenTokens(obj, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("$")) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && "$value" in value) {
      result[path] = value.$value;
    } else if (value && typeof value === "object") {
      Object.assign(result, flattenTokens(value, path));
    }
  }
  return result;
}

// Resolve a single alias like "{color.gray.90}" against the primitives lookup
function resolveAlias(value, lookup) {
  if (typeof value !== "string") return value;
  const match = value.match(/^\{(.+)\}$/);
  if (!match) return value;
  const path = match[1];
  if (lookup[path] !== undefined) return lookup[path];
  // Try without the leading category for semantic refs like {border-radius.md}
  return lookup[path] ?? value;
}

// Build the flattened primitive lookup
const primitiveLookup = flattenTokens(primitives);

// Resolve semantic tokens for a given mode
function resolveSemanticMode(mode) {
  const flat = flattenTokens(semantic[mode]);
  const resolved = {};
  for (const [key, value] of Object.entries(flat)) {
    resolved[key] = resolveAlias(value, primitiveLookup);
  }
  return resolved;
}

// Build a nested object from dot-path keys for Tailwind consumption
function nestByDot(flatObj) {
  const result = {};
  for (const [dotPath, value] of Object.entries(flatObj)) {
    const parts = dotPath.split(".");
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = current[parts[i]] || {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

// Extract just the $value from a token group (e.g., spacing, border-radius)
function extractValues(tokenGroup) {
  const result = {};
  for (const [key, token] of Object.entries(tokenGroup)) {
    if (key.startsWith("$")) continue;
    if (token && "$value" in token) {
      result[key] = token.$value;
    }
  }
  return result;
}

// Export resolved tokens
const lightColors = nestByDot(resolveSemanticMode("light"));
const darkColors = nestByDot(resolveSemanticMode("dark"));

module.exports = {
  primitiveLookup,
  resolveAlias,
  light: lightColors,
  dark: darkColors,
  primitives: {
    colors: (() => {
      const result = {};
      for (const [palette, shades] of Object.entries(primitives.color)) {
        if (palette === "transparent") {
          // Flatten transparent.white.16 → transparent-white-16
          for (const [variant, opacities] of Object.entries(shades)) {
            for (const [level, token] of Object.entries(opacities)) {
              result[`transparent-${variant}-${level}`] = token.$value;
            }
          }
        } else {
          result[palette] = extractValues(shades);
        }
      }
      return result;
    })(),
    spacing: extractValues(primitives.spacing),
    borderRadius: extractValues(primitives["border-radius"]),
    size: extractValues(primitives.size),
    sizeIcon: extractValues(primitives["size-icon"]),
    fontSize: extractValues(primitives.font.size),
    fontWeight: extractValues(primitives.font.weight),
    lineHeight: extractValues(primitives.font["line-height"]),
    letterSpacing: extractValues(primitives.font["letter-spacing"]),
    shadow: extractValues(primitives.shadow),
    blur: extractValues(primitives.blur),
  },
};
