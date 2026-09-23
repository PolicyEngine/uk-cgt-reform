"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Client side of the rate explorer: submit a request to the dashboard's own
// API route, then poll while a job is queued. The route decides whether a
// Modal backend or the local CLI answers.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const POLL_MS = 2000;

async function parse(response) {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { detail: text.slice(0, 300) || `HTTP ${response.status}` };
  }
  if (!response.ok) {
    // The Vercel firewall's rate limit answers 403 (or 429) with a non-JSON body.
    if ((response.status === 403 || response.status === 429) && !body.detail?.startsWith("{")) {
      throw new Error(
        body.detail && body.detail.length < 200 && !body.detail.includes("<")
          ? body.detail
          : "Too many submissions from this address; wait a minute and try again.",
      );
    }
    throw new Error(body.detail || `HTTP ${response.status}`);
  }
  return body;
}

export function useExploration() {
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const runId = useRef(0);
  const timer = useRef(null);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => () => stopTimer(), []);

  const reset = useCallback(() => {
    runId.current += 1;
    stopTimer();
    setStatus("idle");
    setResult(null);
    setError(null);
    setElapsedSeconds(0);
  }, []);

  const run = useCallback(async (request) => {
    const id = ++runId.current;
    const startedAt = Date.now();
    stopTimer();
    setStatus("running");
    setResult(null);
    setError(null);
    setElapsedSeconds(0);
    timer.current = setInterval(
      () => setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000)),
      1000,
    );
    const finish = (next) => {
      if (id !== runId.current) return;
      stopTimer();
      setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000));
      next();
    };
    try {
      let body = await parse(
        await fetch(`${BASE_PATH}/api/explore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        }),
      );
      while (body.status === "queued" || body.status === "running") {
        if (id !== runId.current) return;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const jobId = body.job_id ?? body.jobId;
        body = { ...(await parse(await fetch(`${BASE_PATH}/api/explore/status?job=${jobId}`))), job_id: jobId };
      }
      if (body.status === "failed") throw new Error(body.detail || "The run failed.");
      if (body.status !== "done" || !body.result) throw new Error("Unexpected response from the explorer backend.");
      finish(() => {
        setResult(body.result);
        setStatus("done");
      });
    } catch (err) {
      finish(() => {
        setError(err.message || String(err));
        setStatus("error");
      });
    }
  }, []);

  return { run, reset, status, result, error, elapsedSeconds };
}
