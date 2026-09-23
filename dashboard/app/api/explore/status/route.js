import { NextResponse } from "next/server";
import {
  NOT_CONFIGURED,
  NO_STORE,
  backendConfig,
  passThrough,
  proxyHeaders,
} from "../../../../src/lib/exploreBackend";

// Poll a job the Modal gateway queued. Local runs never queue, so this
// route only makes sense with a backend configured.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOB_ID = /^[A-Za-z0-9_-]{4,128}$/;

export async function GET(request) {
  const job = new URL(request.url).searchParams.get("job") || "";
  if (!JOB_ID.test(job)) {
    return NextResponse.json({ detail: "Missing or malformed job id." }, { status: 400, headers: NO_STORE });
  }
  const config = backendConfig();
  if (!config) {
    return NextResponse.json({ detail: NOT_CONFIGURED }, { status: 503, headers: NO_STORE });
  }
  const upstream = await fetch(`${config.url}/status/${job}`, {
    headers: proxyHeaders(config),
    cache: "no-store",
  });
  return passThrough(upstream);
}
