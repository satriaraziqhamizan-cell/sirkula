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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { facility_id, period_start, period_end } = body;

    if (!facility_id || !period_start || !period_end) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: facility_id, period_start, period_end" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check if already closed -> 409
    const { data: existingReport } = await supabase
      .from("period_reports")
      .select("id, status")
      .eq("facility_id", facility_id)
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .eq("status", "closed")
      .maybeSingle();

    if (existingReport) {
      return new Response(
        JSON.stringify({ error: "Laporan periode ini sudah pernah ditutup sebelumnya.", code: "period_already_closed" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch all batches in period
    const { data: batches } = await supabase
      .from("batches")
      .select(`
        id, weight_in_total_kg, status, balance_status,
        batch_items (weight_sorted_kg, material_categories(name)),
        onsite_processing (weight_kg, method)
      `)
      .eq("facility_id", facility_id)
      .neq("status", "void")
      .gte("received_at", `${period_start}T00:00:00`)
      .lte("received_at", `${period_end}T23:59:59`);

    // 3. Fetch all shipments in period with confirmations
    const { data: shipments } = await supabase
      .from("shipments")
      .select(`
        id, status, purpose,
        shipment_lines (weight_kg, batch_id),
        confirmations (weight_received_kg, status)
      `)
      .eq("facility_id", facility_id)
      .neq("status", "void")
      .gte("shipped_at", `${period_start}T00:00:00`)
      .lte("shipped_at", `${period_end}T23:59:59`);

    // 4. Calculate metrics
    let totalInKg = 0;
    let claimedRecycledKg = 0;
    let verifiedRecycledKg = 0;
    let verifiedProvisionalKg = 0;

    for (const b of (batches || [])) {
      totalInKg += Number(b.weight_in_total_kg || 0);
      for (const item of ((b as any).batch_items || [])) {
        claimedRecycledKg += Number(item.weight_sorted_kg || 0);
      }
      for (const on of ((b as any).onsite_processing || [])) {
        claimedRecycledKg += Number(on.weight_kg || 0);
      }
    }

    for (const s of (shipments || [])) {
      const conf = (s as any).confirmations?.[0];
      const sentWeight = ((s as any).shipment_lines || []).reduce((acc: number, l: any) => acc + Number(l.weight_kg || 0), 0);

      if (s.status === "dikonfirmasi" && conf && conf.status === "diterima") {
        verifiedRecycledKg += Number(conf.weight_received_kg || sentWeight);
        verifiedProvisionalKg += Number(conf.weight_received_kg || sentWeight);
      } else if (s.status === "dikirim") {
        verifiedProvisionalKg += sentWeight;
      }
    }

    const rr = totalInKg > 0 ? claimedRecycledKg / totalInKg : 0;
    const vrr = totalInKg > 0 ? verifiedRecycledKg / totalInKg : 0;
    const vrrP = totalInKg > 0 ? verifiedProvisionalKg / totalInKg : 0;
    const gap = rr - vrr;

    // 5. Generate canonical snapshot hash
    const ENGINE_VERSION = "2.4.0";
    const canonicalString = [
      facility_id,
      period_start,
      period_end,
      totalInKg.toFixed(3),
      verifiedRecycledKg.toFixed(3),
      rr.toFixed(4),
      vrr.toFixed(4),
      gap.toFixed(4),
      ENGINE_VERSION,
    ].join("|");

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(canonicalString));
    const snapshotHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 6. Save period report
    const { data: newReport, error: saveErr } = await supabase
      .from("period_reports")
      .upsert({
        facility_id,
        period_start,
        period_end,
        status: "closed",
        total_in_kg: totalInKg,
        verified_kg: verifiedRecycledKg,
        verified_p_kg: verifiedProvisionalKg,
        rr,
        vrr,
        vrr_p: vrrP,
        gap,
        engine_version: ENGINE_VERSION,
        snapshot_hash: snapshotHash,
        closed_by: user.id,
        closed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveErr) {
      throw saveErr;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        report: newReport,
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
