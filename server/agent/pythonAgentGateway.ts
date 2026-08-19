import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export type PythonAgentCitation = {
  title: string;
  excerpt: string;
  sourceLabel: string;
  sourceUrl: string;
  score: number;
};

export type PythonAgentRoute = {
  intent: "policy_qa" | "product_search" | "own_order" | "human_handoff";
  workflow: Array<{ stage: "received" | "intent_routed" | "retrieval" | "handoff_ready"; detail: string }>;
  citations: PythonAgentCitation[];
  handoff: boolean;
  runtime: "fastapi-langgraph-chroma";
};

export type PythonIndexDocumentInput = {
  documentId: number;
  title: string;
  sourceLabel: string;
  sourceUrl: string;
  content: string;
  contentFingerprint: string;
};

export type PythonIndexDocumentResult = {
  documentId: number;
  chunkCount: number;
  collectionCount: number;
  indexVersion: string;
  embeddingBackend: "fastembed-bge";
};

let pythonProcess: ChildProcess | undefined;
let shutdownRegistered = false;

function isEnabled() {
  if (process.env.CAMPUSMATE_PYTHON_AGENT === "true") return true;
  return process.env.CAMPUSMATE_PYTHON_AGENT !== "false" && process.env.VITEST !== "true" && process.env.NODE_ENV !== "test";
}

function agentUrl() {
  if (process.env.CAMPUSMATE_PYTHON_AGENT_URL) return process.env.CAMPUSMATE_PYTHON_AGENT_URL;
  const port = process.env.CAMPUSMATE_PYTHON_AGENT_PORT ?? "8765";
  return `http://127.0.0.1:${port}`;
}

function startPythonAgent() {
  if (!isEnabled() || process.env.CAMPUSMATE_PYTHON_AGENT_URL || pythonProcess?.exitCode === null) return;
  const port = process.env.CAMPUSMATE_PYTHON_AGENT_PORT ?? "8765";
  pythonProcess = spawn("python3", ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", port], {
    cwd: path.resolve(process.cwd(), "python-agent"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  pythonProcess.stdout?.on("data", data => console.log(`[PythonAgent] ${String(data).trim()}`));
  pythonProcess.stderr?.on("data", data => console.warn(`[PythonAgent] ${String(data).trim()}`));
  pythonProcess.on("exit", code => {
    console.warn(`[PythonAgent] exited with code ${code ?? "unknown"}`);
    pythonProcess = undefined;
  });
  if (!shutdownRegistered) {
    shutdownRegistered = true;
    const stop = () => pythonProcess?.kill("SIGTERM");
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  }
}

export async function routeWithPythonAgent(message: string): Promise<PythonAgentRoute | null> {
  if (!isEnabled()) return null;
  startPythonAgent();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch(`${agentUrl()}/v1/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json() as PythonAgentRoute;
    return data.runtime === "fastapi-langgraph-chroma" ? data : null;
  } catch {
    // The Node gateway keeps the secure, previously-tested local routing fallback.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function indexPublicKnowledgeDocument(input: PythonIndexDocumentInput): Promise<PythonIndexDocumentResult | null> {
  if (!isEnabled()) return null;
  startPythonAgent();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(`${agentUrl()}/v1/index/documents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (response.ok) return await response.json() as PythonIndexDocumentResult;
      if (response.status >= 400 && response.status < 500) return null;
    } catch {
      // A freshly spawned sidecar may still be loading the BGE runtime; retry only this admin path.
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return null;
}
