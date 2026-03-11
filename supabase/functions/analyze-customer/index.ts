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
    const { customer_phone, tenant_id } = await req.json();
    if (!customer_phone || !tenant_id) throw new Error("Missing params");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch customer orders with items
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, total, status, payment_method, created_at, utm_source, utm_campaign")
      .eq("tenant_id", tenant_id)
      .eq("customer_phone", customer_phone)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ analysis: "Cliente sem pedidos suficientes para análise." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch items for these orders
    const orderIds = orders.map((o: any) => o.id);
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity, unit_price, order_id")
      .in("order_id", orderIds);

    // Build context
    const orderSummary = orders.map((o: any) => {
      const oItems = (items || []).filter((i: any) => i.order_id === o.id);
      return `Pedido #${o.order_number} (${new Date(o.created_at).toLocaleDateString("pt-BR")}): R$${o.total} - ${o.payment_method} - Itens: ${oItems.map((i: any) => `${i.quantity}x ${i.product_name}`).join(", ")}${o.utm_source ? ` [via ${o.utm_source}]` : ""}`;
    }).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um analista de CRM especializado em restaurantes delivery. Analise o histórico de pedidos do cliente e forneça insights acionáveis em português brasileiro. Seja conciso e direto. Formate em tópicos curtos com emojis.

Inclua:
- 🍽️ Preferências alimentares (produtos mais pedidos)
- 📅 Padrão de frequência (dias/horários)
- 💰 Comportamento de gasto (ticket médio, tendência)
- 📢 Canal de aquisição principal
- 🎯 Recomendação de ação (cupom, promoção personalizada)
- ⚠️ Risco de churn (baixo/médio/alto)

Máximo 200 palavras.`
          },
          {
            role: "user",
            content: `Histórico do cliente:\n${orderSummary}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Não foi possível gerar análise.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-customer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
