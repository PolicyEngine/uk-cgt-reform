import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import {
  NOT_CONFIGURED,
  NO_STORE,
  backendConfig,
  onVercel,
  passThrough,
  proxyHeaders,
} from "../../../src/lib/exploreBackend";

// Submit a rate schedule. With a backend configured this forwards to the
// Modal gateway (which answers at once from its cache or queues a job).
// Without one, and off Vercel, it runs the pipeline's own CLI locally, which
// serves from and writes the local result cache (data/explore_results).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(process.cwd(), "..");
const DATASET_KEY = /^[a-z0-9_]+$/;
const BANDS = ["basic_rate", "higher_rate", "additional_rate"];

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

// Only clean scalars reach the command line; the CLI validates the rest.
function cliArgs(body) {
  const rates = body?.rates ?? {};
  const values = BANDS.map((band) => rates[band]);
  if (!values.every((v) => typeof v === "number" && Number.isFinite(v))) {
    return { error: "rates must give basic_rate, higher_rate and additional_rate as numbers." };
  }
  const dataset = body.dataset ?? "";
  if (dataset && !DATASET_KEY.test(dataset)) return { error: "Unknown dataset." };
  const elasticity = body.elasticity ?? -0.7;
  if (typeof elasticity !== "number" || !Number.isFinite(elasticity)) {
    return { error: "elasticity must be a number." };
  }
  const args = [
    "-m",
    "uk_equalising_cgt.explore_cli",
    "--json",
    "--quiet",
    "--basic",
    String(values[0]),
    "--higher",
    String(values[1]),
    "--additional",
    String(values[2]),
    "--elasticity",
    String(elasticity),
  ];
  if (dataset) args.push("--dataset", dataset);
  return { args };
}

async function runLocally(args) {
  const python = process.env.PYTHON || path.join(REPO_ROOT, ".venv", "bin", "python");
  const { stdout } = await execFileAsync(python, args, {
    cwd: REPO_ROOT,
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ detail: "The request body must be JSON." }, 400);
  }
  const config = backendConfig();
  if (config) {
    const upstream = await fetch(`${config.url}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...proxyHeaders(config) },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    return passThrough(upstream);
  }
  if (onVercel()) return json({ detail: NOT_CONFIGURED }, 503);

  const { args, error } = cliArgs(body);
  if (error) return json({ detail: error }, 400);
  try {
    const result = await runLocally(args);
    return json({ status: "done", result });
  } catch (err) {
    const stderr = (err.stderr || "").trim();
    if (err.code === 2) return json({ detail: stderr.replace(/^error:\s*/, "") }, 400);
    return json(
      { detail: stderr.split("\n").slice(-3).join(" ") || err.message || "Local run failed." },
      500,
    );
  }
}
