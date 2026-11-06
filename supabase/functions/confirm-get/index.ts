import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// In-memory rate limiting map per IP (10 attempts per minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 15;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Terlalu banyak permintaan. Silakan tunggu 1 menit." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    let token = url.searchParams.get("token");
    if (!token && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      token = body.token;
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token konfirmasi wajib disertakan." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const tokenPepper = Deno.env.get("TOKEN_PEPPER") || "sirkula-salt-2026";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Compute token hash
    const encoder = new TextEncoder();
    const dataToHash = encoder.encode(token.trim() + tokenPepper);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataToHash);
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Query token
    const { data: tokenRec, error: tokenErr } = await supabase
      .from("confirmation_tokens")
      .select("id, shipment_id, expires_at, used_at, revoked_at, failed_attempts")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (tokenErr || !tokenRec) {
      return new Response(
        JSON.stringify({ error: "Tautan konfirmasi tidak ditemukan atau salah." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration or already used
    if (tokenRec.revoked_at) {
      return new Response(
        JSON.stringify({ error: "Tautan konfirmasi telah dibatalkan oleh pihak fasilitas." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tokenRec.used_at) {
      return new Response(
        JSON.stringify({ error: "Tautan konfirmasi ini sudah pernah digunakan sebelumnya." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRec.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Tautan konfirmasi telah melewati batas waktu kedaluwarsa." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch shipment metadata WITHOUT weight
    const { data: shipment, error: shipErr } = await supabase
      .from("shipments")
      .select(`
        id, shipped_at, purpose,
        facilities (name),
        partners (name, partner_type),
        shipment_lines (material_categories(name))
      `)
      .eq("id", tokenRec.shipment_id)
      .single();

    if (shipErr || !shipment) {
      return new Response(
        JSON.stringify({ error: "Data pengiriman tidak ditemukan." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const materialNames = Array.from(
      new Set(
        ((shipment as any).shipment_lines || [])
          .map((line: any) => line.material_categories?.name)
          .filter(Boolean)
      )
    );

    // CRITICAL: NEVER return weight_sent_kg or weight_kg in any form
    return new Response(
      JSON.stringify({
        facility_name: (shipment as any).facilities?.name || "TPS 3R",
        partner_name: (shipment as any).partners?.name || "Mitra",
        partner_type: (shipment as any).partners?.partner_type,
        purpose: shipment.purpose,
        shipped_at: shipment.shipped_at,
        materials: materialNames,
        expires_at: tokenRec.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
