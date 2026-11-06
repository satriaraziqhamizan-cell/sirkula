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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { facility_id, scope = "all" } = body;

    let targetFacilities = [];
    if (facility_id) {
      targetFacilities = [{ id: facility_id }];
    } else {
      const { data: facs } = await supabase.from("facilities").select("id, name, ack_timeout_hours").eq("is_active", true);
      targetFacilities = facs || [];
    }

    const ENGINE_VERSION = "2.4.0";
    let evaluatedCount = 0;
    let newAnomaliesCount = 0;

    for (const fac of targetFacilities) {
      // 1. Fetch active threshold
      const { data: thrSets } = await supabase
        .from("threshold_sets")
        .select("*")
        .or(`facility_id.eq.${fac.id},facility_id.is.null`)
        .eq("status", "beku")
        .order("version", { ascending: false })
        .limit(1);

      const thr = thrSets?.[0] || {
        params: { tau_neg: 0.02, tau_d: 0.05, z_cutoff: 3.5, ack_timeout_hours: 72 },
        provisional: true,
      };

      const tauNeg = thr.params?.tau_neg || 0.02;
      const tauD = thr.params?.tau_d || 0.05;
      const ackTimeout = thr.params?.ack_timeout_hours || 72;

      // 2. Evaluate R1 (Negative Closure Error on closed batches)
      if (scope === "all" || scope === "batch") {
        const { data: closedBatches } = await supabase
          .from("batches")
          .select("id, code, weight_in_total_kg, e_kg, e_rel, status")
          .eq("facility_id", fac.id)
          .eq("status", "ditutup");

        for (const b of (closedBatches || [])) {
          evaluatedCount++;
          if (b.e_rel !== null && b.e_rel < -tauNeg) {
            // Check existing open anomaly to maintain idempotency
            const { data: existing } = await supabase
              .from("anomalies")
              .select("id, status")
              .eq("facility_id", fac.id)
              .eq("rule_code", "R1")
              .eq("entity_id", b.id)
              .eq("status", "open")
              .maybeSingle();

            if (!existing) {
              await supabase.from("anomalies").insert({
                facility_id: fac.id,
                rule_code: "R1",
                severity: b.e_rel < -0.1 ? "tinggi" : "sedang",
                entity_type: "batch",
                entity_id: b.id,
                reason_text: `Closure error negatif sebesar ${(b.e_rel * 100).toFixed(1)}% melampaui batas toleransi -${(tauNeg * 100).toFixed(1)}%.`,
                status: "open",
                detected_at: new Date().toISOString(),
              });
              newAnomaliesCount++;
            }
          }
        }
      }

      // 3. Evaluate R4 (Timeout konfirmasi pengiriman melewati ack_timeout_hours)
      if (scope === "all" || scope === "shipment" || scope === "daily") {
        const cutoffTime = new Date(Date.now() - ackTimeout * 3600 * 1000).toISOString();
        const { data: overdueShipments } = await supabase
          .from("shipments")
          .select("id, shipped_at, status")
          .eq("facility_id", fac.id)
          .eq("status", "dikirim")
          .lt("shipped_at", cutoffTime);

        for (const s of (overdueShipments || [])) {
          evaluatedCount++;
          // Mark overdue
          await supabase.from("shipments").update({ status: "kedaluwarsa", needs_review: true }).eq("id", s.id);

          const { data: existing } = await supabase
            .from("anomalies")
            .select("id")
            .eq("facility_id", fac.id)
            .eq("rule_code", "R4")
            .eq("entity_id", s.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from("anomalies").insert({
              facility_id: fac.id,
              rule_code: "R4",
              severity: "sedang",
              entity_type: "shipment",
              entity_id: s.id,
              reason_text: `Mitra penerima tidak memberikan konfirmasi dalam batas waktu ${ackTimeout} jam.`,
              status: "open",
              detected_at: new Date().toISOString(),
            });
            newAnomaliesCount++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        engine_version: ENGINE_VERSION,
        evaluated: evaluatedCount,
        new_anomalies: newAnomaliesCount,
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
