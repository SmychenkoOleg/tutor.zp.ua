// Minimal, privacy-preserving device classification at the moment a lead is received.
// Do not persist the full User-Agent, Client Hints or a device fingerprint.
const TV = /\b(?:smart[- ]?tv|hbbtv|googletv|android tv|appletv|fire tv|aft[bstm]|web0s|webos\.tv|netcast|viera|bravia|roku|tizen.*tv|tv.*tizen|crkey|chromecast|vidaa|shield android tv)\b/i;
const TABLET = /\b(?:ipad|tablet|playbook|kindle|silk|nexus (?:7|9|10)|pixel c|sm-t\d+|sm-x\d+|lenovo tab)\b/i;
const MOBILE = /\b(?:iphone|ipod|windows phone|blackberry|bb10|opera mini|iemobile|mobile)\b/i;
const DESKTOP = /\b(?:windows nt|macintosh|mac os x|x11|cros|ubuntu|fedora|desktop)\b/i;
const BOT = /\b(?:bot|crawler|spider|headless|slurp|lighthouse|pingdom|monitoring)\b/i;

/** @returns {'mobile'|'desktop'|'tablet'|'tv'|'unknown'} */
export function classifyDevice(request) {
  const ua = (request?.headers?.get?.("user-agent") ?? "").slice(0, 512);
  const mobileHint = request?.headers?.get?.("sec-ch-ua-mobile");
  if (BOT.test(ua)) return "unknown";
  if (TV.test(ua)) return "tv";
  if (TABLET.test(ua)) return "tablet";
  // iPadOS may advertise itself as Macintosh, but still include "Mobile/".
  if (/macintosh/i.test(ua) && /mobile\//i.test(ua)) return "tablet";
  // Android user agents without "Mobile" typically describe tablets.
  if (/android/i.test(ua)) return /mobile/i.test(ua) ? "mobile" : "tablet";
  if (MOBILE.test(ua)) return "mobile";
  if (DESKTOP.test(ua)) return "desktop";
  // Client Hint is a fallback only; "?0" does not distinguish a PC from a tablet.
  if (mobileHint === "?1") return "mobile";
  return "unknown";
}

const LABELS = Object.freeze({
  mobile: "Мобільний",
  desktop: "Комп’ютер",
  tablet: "Планшет",
  tv: "Телевізор",
  unknown: "Невідомо",
});

export function deviceTypeLabel(type) {
  return Object.hasOwn(LABELS, type ?? "") ? LABELS[type] : LABELS.unknown;
}
