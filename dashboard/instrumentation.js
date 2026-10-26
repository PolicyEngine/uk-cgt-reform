// Runs once per server instance, before it handles a request (Next.js
// instrumentation; enabled by `experimental.instrumentationHook` in
// next.config.js on Next.js 14).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { removeCompromisedEmudhraRoots } = await import("./src/lib/compromisedCaRoots");
    removeCompromisedEmudhraRoots();
  }
}
