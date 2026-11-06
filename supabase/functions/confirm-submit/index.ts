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
    const body = await req.json();
    const { token, weight_received_kg, status, note, photo_path } = body;

    if (!token || weight_received_kg === undefined || weight_received_kg === null || !status) {
      return new Response(
        JSON.stringify({ error: "Data konfirmasi tidak lengkap." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const weightNum = Number(weight_received_kg);
    if (isNaN(weightNum) || weightNum < 0) {
      return new Response(
        JSON.stringify({ error: "Berat yang diterima harus berupa angka non-negatif." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const tokenPepper = Deno.env.get("TOKEN_PEPPER") || "sirkula-salt-2026";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Call stored procedure submit_blind_confirmation for atomic transaction & anomaly evaluation
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const { data: rpcRes, error: rpcErr } = await supabase.rpc("submit_blind_confirmation", {
      p_token: token.trim(),
      p_weight_received: weightNum,
      p_status: status,
      p_note: note || null,
      p_photo_path: photo_path || null,
      p_device_info: { ip_hash: clientIp, user_agent: userAgent },
    });

    if (rpcErr) {
      throw rpcErr;
    }

    if (rpcRes.status !== 200) {
      return new Response(
        JSON.stringify({ error: rpcRes.message || "Gagal memproses konfirmasi.", code: rpcRes.code }),
        { status: rpcRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Konfirmasi penerimaan material berhasil dicatat di sistem SIRKULA.",
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
