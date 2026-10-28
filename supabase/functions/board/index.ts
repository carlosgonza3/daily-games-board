import { createClient } from "npm:@supabase/supabase-js@2";

const games = new Set(["wordle", "perceptle", "krillion", "maptap", "sizeitup"]);
const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map((value) => value.trim());
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase server credentials");

const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allow = allowedOrigins.includes("*") || allowedOrigins.includes(origin) ? (origin || "*") : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, value: unknown, status = 200) {
  return Response.json(value, { status, headers: cors(req) });
}

function fail(req: Request, message: string, status = 400) {
  return json(req, { message }, status);
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(value);
}

function validName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 40;
}

function cleanResult(value: Record<string, unknown>, player: string) {
  const day = typeof value.day === "string" ? value.day : "";
  const game = typeof value.game === "string" ? value.game : "";
  const score = Number(value.score);
  const display = typeof value.display === "string" ? value.display : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !games.has(game) || !Number.isInteger(score) || !display || display.length > 100) {
    throw new Error("Invalid result");
  }
  const puzzle = value.puzzle == null ? null : Number(value.puzzle);
  if (puzzle != null && !Number.isInteger(puzzle)) throw new Error("Invalid puzzle number");
  const raw = typeof value.raw === "string" ? value.raw.slice(0, 4000) : null;
  const grid = typeof value.grid === "string" ? value.grid.slice(0, 2000) : null;
  const rounds = Array.isArray(value.rounds) ? value.rounds.slice(0, 20) : null;
  return { day, player, game, score, display, puzzle, rounds, grid, raw, updated_at: new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "GET" && req.method !== "POST") return fail(req, "Method not allowed", 405);

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 32_000) return fail(req, "Request too large", 413);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";

  try {
    if (req.method === "GET" && action === "players") {
      const { data, error } = await db.from("players").select("id,name,created_at").order("created_at");
      if (error) throw error;
      return json(req, data || []);
    }

    if (req.method === "GET" && action === "results") {
      const since = url.searchParams.get("since") || "";
      const from = Math.max(0, Number.parseInt(url.searchParams.get("from") || "0", 10) || 0);
      const limit = Math.min(1000, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "1000", 10) || 1000));
      let query = db.from("results")
        .select("id,day,player,game,score,display,puzzle,rounds,grid")
        .order("day", { ascending: false }).order("id", { ascending: true })
        .range(from, from + limit - 1);
      if (since) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return fail(req, "Invalid date");
        query = query.gte("day", since);
      }
      const { data, error } = await query;
      if (error) throw error;
      return json(req, data || []);
    }

    if (req.method !== "POST") return fail(req, "Unknown action", 404);
    const body = await req.json() as Record<string, unknown>;

    if (action === "upsertPlayer") {
      if (!validId(body.id) || !validName(body.name)) return fail(req, "Invalid player");
      const { error } = await db.from("players").upsert({ id: body.id, name: body.name.trim() }, { onConflict: "id" });
      if (error) throw error;
      return json(req, { ok: true });
    }

    if (action === "renamePlayer") {
      if (!validId(body.id) || !validName(body.name)) return fail(req, "Invalid player");
      const { error } = await db.from("players").update({ name: body.name.trim() }).eq("id", body.id);
      if (error) throw error;
      return json(req, { ok: true });
    }

    if (action === "saveResults") {
      const player = body.player as Record<string, unknown> | undefined;
      const results = body.results;
      if (!player || !validId(player.id) || !validName(player.name) || !Array.isArray(results) || results.length < 1 || results.length > 5) {
        return fail(req, "Invalid results submission");
      }
      const rows = results.map((result) => cleanResult(result as Record<string, unknown>, player.id));
      const { error: playerError } = await db.from("players").upsert({ id: player.id, name: player.name.trim() }, { onConflict: "id" });
      if (playerError) throw playerError;
      const { error } = await db.from("results").upsert(rows, { onConflict: "day,player,game" });
      if (error) throw error;
      return json(req, { ok: true });
    }

    if (action === "deleteResult") {
      const id = Number(body.id);
      if (!Number.isInteger(id) || !validId(body.player)) return fail(req, "Invalid result");
      const { error } = await db.from("results").delete().eq("id", id).eq("player", body.player);
      if (error) throw error;
      return json(req, { ok: true });
    }

    return fail(req, "Unknown action", 404);
  } catch (error) {
    console.error(error);
    return fail(req, "The board service could not complete that request", 500);
  }
});
