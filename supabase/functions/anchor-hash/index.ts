import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// anchor-hash: Runs weekly (Senin 02:00 WIB)
// 1. Fetches latest event_log hash and seq per active facility
// 2. Writes to hash_anchors table
// 3. Can be wired to send weekly digest email or external timestamping

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: facilities } = await supabase.from("facilities").select("id, name").eq("is_active", true);

    const anchorsCreated = [];
    for (const fac of (facilities || [])) {
      const { data: latestEvent } = await supabase
        .from("event_log")
        .select("seq, hash, occurred_at")
        .eq("facility_id", fac.id)
        .order("seq", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestEvent) {
        const { data: anchor } = await supabase.from("hash_anchors").insert({
          facility_id: fac.id,
          seq_end: latestEvent.seq,
          hash: latestEvent.hash,
          anchor_type: "weekly_digest",
          reference_info: `Mingguan per ${new Date().toISOString().slice(0, 10)} - ${fac.name}`,
        }).select().single();

        anchorsCreated.push(anchor);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        anchors_created: anchorsCreated.length,
        timestamp: new Date().toISOString(),
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
