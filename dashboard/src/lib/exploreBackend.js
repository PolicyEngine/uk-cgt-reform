// Server-only helpers for the rate explorer's Next routes. The Modal gateway
// sits behind proxy authentication; the credentials never reach the browser.
export function backendConfig() {
  const url = process.env.CGT_EXPLORER_URL;
  if (!url) return null;
  return {
    url: url.replace(/\/+$/, ""),
    key: process.env.CGT_EXPLORER_MODAL_KEY || "",
    secret: process.env.CGT_EXPLORER_MODAL_SECRET || "",
  };
}

export function proxyHeaders(config) {
  return { "Modal-Key": config.key, "Modal-Secret": config.secret };
}

export const NO_STORE = { "Cache-Control": "no-store" };

// Pass an upstream response through with its status. A non-JSON body (Modal's
// own proxy-auth rejection is plain text) is wrapped so clients always get JSON.
export async function passThrough(upstream) {
  const text = await upstream.text();
  let body = text;
  try {
    JSON.parse(text);
  } catch {
    body = JSON.stringify({ detail: text.trim().slice(0, 300) || `HTTP ${upstream.status}` });
  }
  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", ...NO_STORE },
  });
}

export const onVercel = () => process.env.VERCEL === "1";

export const NOT_CONFIGURED =
  "The rate explorer backend is not configured on this deployment (CGT_EXPLORER_URL is unset). See the README's Rate explorer section.";
