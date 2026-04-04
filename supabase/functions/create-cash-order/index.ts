import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CartItem {
  name: string;
  price: number;
  quantity: number;
}

interface OrderRequest {
  tenant_id: string;
  items: CartItem[];
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_address?: string;
  delivery_neighborhood?: string;
  delivery_city?: string;
  delivery_notes?: string;
  delivery_fee: number;
  payment_method: "cash" | "credit_card" | "debit_card";
  discount?: number;
  coupon_code?: string;
  coupon_id?: string;
  session_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_ad_link?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: OrderRequest = await req.json();
    const {
      tenant_id, items, customer_name, customer_phone, customer_email,
      delivery_address, delivery_neighborhood, delivery_city, delivery_notes,
      delivery_fee, payment_method, discount, coupon_code, coupon_id, session_id,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_ad_link,
    } = body;

    if (!tenant_id || !items?.length || !customer_name || !customer_phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    // total calculated in insert

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        tenant_id,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        delivery_address: delivery_address || null,
        delivery_neighborhood: delivery_neighborhood || null,
        delivery_city: delivery_city || null,
        delivery_notes: delivery_notes || null,
        delivery_fee: delivery_fee || 0,
        subtotal,
        discount: discount || 0,
        coupon_code: coupon_code || null,
        coupon_id: coupon_id || null,
        total: subtotal - (discount || 0) + (delivery_fee || 0),
        payment_method,
        payment_status: "pending",
        status: "new",
        session_id: session_id || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_term: utm_term || null,
        utm_content: utm_content || null,
        utm_ad_link: utm_ad_link || null,
      })
      .select("id, order_number")
      .single();

    if (orderError) {
      console.error("Order error:", orderError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar pedido" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      tenant_id,
      product_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      total: item.price * item.quantity,
    }));

    await supabaseAdmin.from("order_items").insert(orderItems);

    return new Response(
      JSON.stringify({ order_id: order.id, order_number: order.order_number }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Order error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
