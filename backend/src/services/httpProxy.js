import { isIP } from "node:net";

// Proxy trust is deployment-specific. Never trust arbitrary forwarded headers
// merely because a request supplies them; configure verified hops or CIDRs.
export function resolveTrustProxy(value = process.env.TRUST_PROXY || "") {
  const text = String(value).trim();
  if (!text || text === "false") return false;
  if (/^\d+$/.test(text)) {
    const hops = Number(text);
    if (hops <= 10) return hops;
    throw new Error("TRUST_PROXY hop count must be between 0 and 10.");
  }
  const entries = text.split(",").map(entry => entry.trim());
  for (const entry of entries) {
    if (["loopback", "linklocal", "uniquelocal"].includes(entry)) continue;
    const [address, prefix, extra] = entry.split("/");
    const version = isIP(address);
    if (!version || extra !== undefined || (prefix !== undefined &&
        (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)))) {
      throw new Error("TRUST_PROXY must contain verified proxy hops, IP addresses or CIDRs; blanket trust is not allowed.");
    }
  }
  return entries;
}
