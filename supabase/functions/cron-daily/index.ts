import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// cron-daily: Runs at 01:00 WIB daily
// 1. Marks expired unconfirmed shipments exceeding ack_timeout_hours as 'kedaluwarsa'
// 2. Triggers anomaly rule R4 (Timeout konfirmasi)
// 3. Summarizes pending issues for facility notifications

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Call engine-run for daily scope
    const { data: facilities } = await supabase.from("facilities").select("id, ack_timeout_hours").eq("is_active", true);

    let expiredShipments = 0;
    for (const fac of (facilities || [])) {
      const timeoutHours = fac.ack_timeout_hours || 72;
      const cutoff = new Date(Date.now() - timeoutHours * 3600 * 1000).toISOString();

      const { data: overdue } = await supabase
        .from("shipments")
        .select("id")
        .eq("facility_id", fac.id)
        .eq("status", "dikirim")
        .lt("shipped_at", cutoff);

      for (const s of (overdue || [])) {
        await supabase.from("shipments").update({ status: "kedaluwarsa", needs_review: true }).eq("id", s.id);

        await supabase.from("anomalies").insert({
          facility_id: fac.id,
          rule_code: "R4",
          severity: "sedang",
          entity_type: "shipment",
          entity_id: s.id,
          reason_text: `Mitra penerima tidak memberikan konfirmasi dalam batas waktu ${timeoutHours} jam.`,
          status: "open",
        }).select();

        expiredShipments++;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        cron: "daily",
        timestamp: new Date().toISOString(),
        expired_shipments_processed: expiredShipments,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
