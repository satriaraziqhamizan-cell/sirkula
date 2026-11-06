import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const tokenPepper = Deno.env.get("TOKEN_PEPPER") || "sirkula-salt-2026";
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://sirkula.id";

    // 1. Verify caller authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { shipment_id } = body;
    if (!shipment_id) {
      return new Response(
        JSON.stringify({ error: "Missing shipment_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Lookup shipment and facility timeout
    const { data: shipment, error: shipErr } = await supabase
      .from("shipments")
      .select("id, facility_id, facilities(ack_timeout_hours)")
      .eq("id", shipment_id)
      .single();

    if (shipErr || !shipment) {
      return new Response(
        JSON.stringify({ error: "Shipment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Revoke any previous unconfirmed tokens for this shipment
    await supabase
      .from("confirmation_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("shipment_id", shipment_id)
      .is("used_at", null)
      .is("revoked_at", null);

    // 4. Generate random 32-byte base64url token
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    let binary = "";
    for (let i = 0; i < randomBytes.byteLength; i++) {
      binary += String.fromCharCode(randomBytes[i]);
    }
    const rawToken = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    // 5. Compute SHA-256(rawToken + TOKEN_PEPPER)
    const encoder = new TextEncoder();
    const dataToHash = encoder.encode(rawToken + tokenPepper);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataToHash);
    const tokenHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const timeoutHours = (shipment as any).facilities?.ack_timeout_hours || 72;
    const expiresAt = new Date(Date.now() + timeoutHours * 3600 * 1000).toISOString();

    // 6. Save ONLY token_hash to confirmation_tokens
    const { error: insertErr } = await supabase.from("confirmation_tokens").insert({
      shipment_id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    });

    if (insertErr) {
      throw insertErr;
    }

    const confirmUrl = `${appBaseUrl.replace(/\/$/, "")}/k/${rawToken}`;

    return new Response(
      JSON.stringify({
        url: confirmUrl,
        expires_at: expiresAt,
        timeout_hours: timeoutHours,
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
