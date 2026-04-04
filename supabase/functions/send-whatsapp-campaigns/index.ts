import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const now = new Date();
    const currentHour = now.getUTCHours() - 3; // BRT = UTC-3
    const currentDay = now.getUTCDay();
    const currentDayOfMonth = now.getUTCDate();
    const todayMMDD = `${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    // Get all active campaigns
    const { data: campaigns } = await supabase
      .from("whatsapp_campaigns")
      .select("*")
      .eq("is_active", true);

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: "No active campaigns" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    const results: any[] = [];

    for (const campaign of campaigns) {
      // Check if it's the right hour
      if (campaign.send_hour !== null && campaign.send_hour !== currentHour) continue;

      // Get WhatsApp instance for this tenant
      const { data: waInstance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", campaign.tenant_id)
        .single();

      if (!waInstance?.instance_name || !waInstance?.instance_token) continue;

      // Get coupon info if attached
      let couponCode = "";
      let couponDiscount = "";
      if (campaign.coupon_id) {
        const { data: coupon } = await supabase
          .from("coupons")
          .select("code, discount_type, discount_value")
          .eq("id", campaign.coupon_id)
          .single();
        if (coupon) {
          couponCode = coupon.code;
          couponDiscount = `${coupon.discount_value}${coupon.discount_type === "percentage" ? "%" : " reais"}`;
        }
      }

      let customers: any[] = [];

      // ── BIRTHDAY CAMPAIGNS ──
      if (campaign.campaign_type === "birthday") {
        const { data } = await supabase
          .from("customers")
          .select("id, name, phone, birthday")
          .eq("tenant_id", campaign.tenant_id)
          .not("birthday", "is", null);

        customers = (data || []).filter((c: any) => {
          if (!c.birthday) return false;
          const bday = c.birthday; // format: YYYY-MM-DD
          const mmdd = bday.slice(5); // MM-DD
          return mmdd === todayMMDD;
        });
      }

      // ── INACTIVE CAMPAIGNS ──
      else if (campaign.campaign_type === "inactive") {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - (campaign.inactive_days || 30));

        const { data } = await supabase
          .from("customers")
          .select("id, name, phone, last_order_at")
          .eq("tenant_id", campaign.tenant_id)
          .lt("last_order_at", cutoffDate.toISOString());

        customers = data || [];

        // Also include customers who never ordered
        const { data: neverOrdered } = await supabase
          .from("customers")
          .select("id, name, phone, last_order_at")
          .eq("tenant_id", campaign.tenant_id)
          .is("last_order_at", null);

        if (neverOrdered) customers = [...customers, ...neverOrdered];

        // Check we haven't already sent to these customers recently (within inactive_days)
        const { data: recentLogs } = await supabase
          .from("whatsapp_campaign_logs")
          .select("customer_phone")
          .eq("campaign_id", campaign.id)
          .gte("sent_at", cutoffDate.toISOString());

        const recentPhones = new Set((recentLogs || []).map((l: any) => l.customer_phone));
        customers = customers.filter((c: any) => !recentPhones.has(c.phone));
      }

      // ── PERIODIC CAMPAIGNS ──
      else if (campaign.campaign_type === "periodic") {
        let shouldSend = false;

        if (campaign.frequency === "weekly") {
          shouldSend = currentDay === (campaign.send_day || 1);
        } else if (campaign.frequency === "biweekly") {
          const weekNum = Math.floor((currentDayOfMonth - 1) / 7);
          shouldSend = currentDay === (campaign.send_day || 1) && (weekNum % 2 === 0);
        } else if (campaign.frequency === "monthly") {
          shouldSend = currentDayOfMonth === (campaign.send_day || 1);
        }

        if (!shouldSend) continue;

        // Send to all customers
        const { data } = await supabase
          .from("customers")
          .select("id, name, phone")
          .eq("tenant_id", campaign.tenant_id);

        customers = data || [];

        // Don't re-send today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data: todayLogs } = await supabase
          .from("whatsapp_campaign_logs")
          .select("customer_phone")
          .eq("campaign_id", campaign.id)
          .gte("sent_at", todayStart.toISOString());

        const sentToday = new Set((todayLogs || []).map((l: any) => l.customer_phone));
        customers = customers.filter((c: any) => !sentToday.has(c.phone));
      }

      // Send messages
      let campaignSent = 0;
      for (const customer of customers) {
        let msg = campaign.template_message
          .replace(/\{\{nome\}\}/g, customer.name.split(" ")[0])
          .replace(/\{\{cupom\}\}/g, couponCode)
          .replace(/\{\{desconto\}\}/g, couponDiscount);

        // AI personalization for inactive campaigns
        if (campaign.use_ai_personalization && LOVABLE_API_KEY && campaign.campaign_type === "inactive") {
          try {
            // Fetch customer order history for AI context
            const { data: orders } = await supabase
              .from("orders")
              .select("id, total, created_at")
              .eq("tenant_id", campaign.tenant_id)
              .eq("customer_phone", customer.phone)
              .neq("status", "cancelled")
              .order("created_at", { ascending: false })
              .limit(10);

            const orderIds = (orders || []).map((o: any) => o.id);
            let itemNames: string[] = [];
            if (orderIds.length > 0) {
              const { data: items } = await supabase
                .from("order_items")
                .select("product_name, quantity")
                .in("order_id", orderIds);
              itemNames = (items || []).map((i: any) => `${i.quantity}x ${i.product_name}`);
            }

            const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content: "Você é um assistente de marketing de restaurante delivery. Gere uma mensagem curta e calorosa (máximo 2 frases) lembrando o cliente de seus pedidos favoritos e sugerindo que peça novamente. Seja informal e amigável. Não inclua cumprimentos. Apenas a sugestão personalizada.",
                  },
                  {
                    role: "user",
                    content: `Itens favoritos do cliente: ${itemNames.join(", ") || "não identificados"}`,
                  },
                ],
              }),
            });

            if (aiResponse.ok) {
              const aiData = await aiResponse.json();
              const aiMsg = aiData.choices?.[0]?.message?.content || "";
              msg = msg.replace(/\{\{mensagem_ia\}\}/g, aiMsg);
            } else {
              msg = msg.replace(/\{\{mensagem_ia\}\}/g, "Temos novidades deliciosas esperando por você!");
            }
          } catch {
            msg = msg.replace(/\{\{mensagem_ia\}\}/g, "Temos novidades deliciosas esperando por você!");
          }
        } else {
          msg = msg.replace(/\{\{mensagem_ia\}\}/g, "");
          msg = msg.replace(/\{\{mensagem_personalizada\}\}/g, "");
        }

        // Clean up empty lines
        msg = msg.replace(/\n{3,}/g, "\n\n").trim();

        const phone = customer.phone.replace(/\D/g, "");
        let status = "sent";

        try {
          const sendRes = await fetch(
            `https://igosantos.uazapi.com/v2/sendText/${waInstance.instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                token: waInstance.instance_token,
              },
              body: JSON.stringify({
                to: `${phone}@s.whatsapp.net`,
                text: msg,
              }),
            }
          );
          if (!sendRes.ok) status = "failed";
        } catch {
          status = "failed";
        }

        // Log
        await supabase.from("whatsapp_campaign_logs").insert({
          campaign_id: campaign.id,
          tenant_id: campaign.tenant_id,
          customer_id: customer.id,
          customer_phone: customer.phone,
          message_sent: msg,
          status,
        });

        if (status === "sent") campaignSent++;

        // Small delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 500));
      }

      // Update campaign stats
      if (campaignSent > 0) {
        await supabase
          .from("whatsapp_campaigns")
          .update({
            total_sent: campaign.total_sent + campaignSent,
            last_sent_at: new Date().toISOString(),
          })
          .eq("id", campaign.id);
      }

      totalSent += campaignSent;
      results.push({
        campaign: campaign.name,
        type: campaign.campaign_type,
        eligible: customers.length,
        sent: campaignSent,
      });
    }

    return new Response(
      JSON.stringify({ totalSent, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-whatsapp-campaigns error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
