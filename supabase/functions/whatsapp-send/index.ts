import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, tenant_id, to, text, number } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: inst } = await supabase
      .from("whatsapp_instances")
      .select("instance_name, instance_token")
      .eq("tenant_id", tenant_id)
      .single();

    if (!inst?.instance_name || !inst?.instance_token) {
      return new Response(JSON.stringify({ error: "WhatsApp não configurado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = `https://${inst.instance_name}.uazapi.com`;
    const headers = { "Content-Type": "application/json", token: inst.instance_token };

    let res: Response;

    if (action === "sendText") {
      const phone = (to || number || "").replace("@s.whatsapp.net", "");
      res = await fetch(`${baseUrl}/send/text`, {
        method: "POST",
        headers,
        body: JSON.stringify({ number: phone, text }),
      });
    } else if (action === "getQrCode") {
      res = await fetch(`${baseUrl}/qrcode`, { headers });
    } else if (action === "status") {
      res = await fetch(`${baseUrl}/status`, { headers });
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-send error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
