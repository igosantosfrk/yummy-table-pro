import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse event without verification first to get tenant_id
    const rawEvent = JSON.parse(body);
    const tenantId =
      rawEvent.data?.object?.metadata?.tenant_id ||
      null;

    if (!tenantId) {
      console.error("No tenant_id in event metadata");
      return new Response(JSON.stringify({ error: "No tenant_id" }), { status: 400 });
    }

    // Get tenant's Stripe secret to construct the Stripe instance
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("stripe_secret_key, stripe_webhook_secret")
      .eq("id", tenantId)
      .single();

    if (!tenant?.stripe_secret_key) {
      console.error("Tenant has no Stripe key:", tenantId);
      return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 400 });
    }

    const stripe = new Stripe(tenant.stripe_secret_key, {
      apiVersion: "2025-08-27.basil",
    });

    // Verify webhook signature if secret is configured
    let event: Stripe.Event;
    if (tenant.stripe_webhook_secret) {
      event = stripe.webhooks.constructEvent(body, signature, tenant.stripe_webhook_secret);
    } else {
      // Fallback: trust the event (not ideal for production, but works for setup)
      event = rawEvent as Stripe.Event;
      console.warn("No webhook secret configured - skipping signature verification");
    }

    // Handle events
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;

        if (orderId) {
          await supabaseAdmin
            .from("orders")
            .update({
              payment_status: "paid",
              stripe_payment_intent_id: session.payment_intent as string || session.id,
            })
            .eq("id", orderId);

          console.log(`Order ${orderId} marked as paid`);
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;

        if (orderId) {
          await supabaseAdmin
            .from("orders")
            .update({
              payment_status: "failed",
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
            })
            .eq("id", orderId);

          console.log(`Order ${orderId} marked as cancelled (session expired)`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const orderId = intent.metadata?.order_id;

        if (orderId) {
          await supabaseAdmin
            .from("orders")
            .update({ payment_status: "failed" })
            .eq("id", orderId);

          console.log(`Order ${orderId} payment failed`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
});
