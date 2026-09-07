import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

type HirenaState = {
  version: number;
  updatedAt: string | null;
  lastType?: string;
  categories: unknown[];
  items: unknown[];
  bookings: unknown[];
  settings: unknown | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __hirenaState: HirenaState | undefined;
}

function stateFilePaths(): string[] {
  return [path.join(process.cwd(), "data", "hirena-state.json"), "/tmp/hirena-state.json"];
}

function defaultState(): HirenaState {
  return { version: 0, updatedAt: null, categories: [], items: [], bookings: [], settings: null };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function readState(): Promise<HirenaState> {
  if (globalThis.__hirenaState) return globalThis.__hirenaState;
  for (const p of stateFilePaths()) {
    try {
      const raw = await readFile(p, "utf-8");
      const parsed = JSON.parse(raw) as HirenaState;
      if (typeof parsed.version === "number") {
        globalThis.__hirenaState = parsed;
        return parsed;
      }
    } catch {}
  }
  return defaultState();
}

async function writeState(state: HirenaState): Promise<void> {
  globalThis.__hirenaState = state;
  const data = JSON.stringify(state);
  let written = false;
  for (const p of stateFilePaths()) {
    try {
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, data, "utf-8");
      written = true;
      break;
    } catch {}
  }
  if (!written) throw new Error("failed to persist state");
}

export async function GET() {
  try {
    const state = await readState();
    if (state.version === 0 && !state.updatedAt) {
      return NextResponse.json({ ...state, data: null }, { headers: corsHeaders() });
    }
    return NextResponse.json(state, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "read failed" }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      type?: string;
      categories?: unknown;
      items?: unknown;
      bookings?: unknown;
      settings?: unknown;
    };

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid body" }, { status: 400, headers: corsHeaders() });
    }

    const hasAny =
      body.type !== undefined ||
      body.categories !== undefined ||
      body.items !== undefined ||
      body.bookings !== undefined ||
      body.settings !== undefined;

    if (!hasAny) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400, headers: corsHeaders() });
    }

    if (body.categories !== undefined && !Array.isArray(body.categories)) {
      return NextResponse.json({ error: "categories must be array" }, { status: 400, headers: corsHeaders() });
    }
    if (body.items !== undefined && !Array.isArray(body.items)) {
      return NextResponse.json({ error: "items must be array" }, { status: 400, headers: corsHeaders() });
    }
    if (body.bookings !== undefined && !Array.isArray(body.bookings)) {
      return NextResponse.json({ error: "bookings must be array" }, { status: 400, headers: corsHeaders() });
    }
    if (body.settings !== undefined && (typeof body.settings !== "object" || body.settings === null || Array.isArray(body.settings))) {
      return NextResponse.json({ error: "settings must be object" }, { status: 400, headers: corsHeaders() });
    }
    if (body.type !== undefined && typeof body.type !== "string") {
      return NextResponse.json({ error: "type must be string" }, { status: 400, headers: corsHeaders() });
    }

    const current = await readState();
    const next: HirenaState = {
      version: (current.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      lastType: typeof body.type === "string" ? body.type : current.lastType,
      categories: Array.isArray(body.categories) ? body.categories : current.categories,
      items: Array.isArray(body.items) ? body.items : current.items,
      bookings: Array.isArray(body.bookings) ? body.bookings : current.bookings,
      settings: body.settings !== undefined ? body.settings : current.settings,
    };

    await writeState(next);
    return NextResponse.json({ version: next.version, updatedAt: next.updatedAt }, { headers: corsHeaders() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "write failed" }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
