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

// Pass an upstream JSON response through unchanged (status and body).
export async function passThrough(upstream) {
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json", ...NO_STORE },
  });
}

export const onVercel = () => process.env.VERCEL === "1";

export const NOT_CONFIGURED =
  "The rate explorer backend is not configured on this deployment (CGT_EXPLORER_URL is unset). See the README's Rate explorer section.";
