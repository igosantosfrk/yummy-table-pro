import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // UaZapi sends different event types
    const event = body.event || body.type;

    // Handle incoming message
    if (event === "messages.upsert" || event === "message" || body.message) {
      const msg = body.message || body.data?.message || body;
      const phone = (msg.from || msg.remoteJid || body.from || "")
        .replace("@s.whatsapp.net", "")
        .replace("@c.us", "");

      if (!phone || phone.includes("@g.us")) {
        // Skip group messages
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pushName = msg.pushName || body.pushName || body.senderName || null;
      const instanceName = body.instance || body.instanceName || null;

      // Find tenant by instance
      let tenantId: string | null = null;
      if (instanceName) {
        const { data: inst } = await supabase
          .from("whatsapp_instances")
          .select("tenant_id")
          .eq("instance_name", instanceName)
          .single();
        tenantId = inst?.tenant_id || null;
      }

      if (!tenantId) {
        // Try to find by checking all instances (fallback)
        const { data: instances } = await supabase
          .from("whatsapp_instances")
          .select("tenant_id, instance_name");
        if (instances && instances.length === 1) {
          tenantId = instances[0].tenant_id;
        }
      }

      if (!tenantId) {
        console.error("Could not determine tenant for webhook");
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine message type and content
      let messageType = "text";
      let content = "";
      let mediaUrl = null;
      let mediaMimeType = null;

      if (msg.message?.conversation) {
        content = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        content = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage) {
        messageType = "image";
        content = msg.message.imageMessage.caption || "";
        mediaUrl = msg.message.imageMessage.url || null;
        mediaMimeType = msg.message.imageMessage.mimetype || "image/jpeg";
      } else if (msg.message?.audioMessage) {
        messageType = "audio";
        mediaUrl = msg.message.audioMessage.url || null;
        mediaMimeType = msg.message.audioMessage.mimetype || "audio/ogg";
      } else if (msg.message?.videoMessage) {
        messageType = "video";
        content = msg.message.videoMessage.caption || "";
        mediaUrl = msg.message.videoMessage.url || null;
      } else if (msg.message?.documentMessage) {
        messageType = "document";
        content = msg.message.documentMessage.fileName || "";
        mediaUrl = msg.message.documentMessage.url || null;
      } else if (msg.message?.stickerMessage) {
        messageType = "sticker";
      } else if (msg.body || msg.text || body.text) {
        content = msg.body || msg.text || body.text || "";
      }

      // Skip if no content and no media
      if (!content && !mediaUrl && messageType === "text") {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine direction
      const fromMe = msg.key?.fromMe || msg.fromMe || false;
      const direction = fromMe ? "outgoing" : "incoming";

      // Format phone number
      const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;

      // Insert message
      await supabase.from("whatsapp_messages").insert({
        tenant_id: tenantId,
        contact_phone: formattedPhone,
        contact_name: pushName,
        direction,
        message_type: messageType,
        content,
        media_url: mediaUrl,
        media_mime_type: mediaMimeType,
        status: fromMe ? "sent" : "delivered",
        wa_message_id: msg.key?.id || msg.id || null,
        is_read: fromMe,
      });

      // Update contact name in existing messages if we got a pushName
      if (pushName && !fromMe) {
        await supabase
          .from("whatsapp_messages")
          .update({ contact_name: pushName })
          .eq("tenant_id", tenantId)
          .eq("contact_phone", formattedPhone)
          .is("contact_name", null);
      }

      // Also update customer name if exists
      if (pushName && !fromMe) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("phone", formattedPhone)
          .single();

        if (!customer) {
          // Auto-create customer from WhatsApp contact
          await supabase.from("customers").insert({
            tenant_id: tenantId,
            phone: formattedPhone,
            name: pushName,
          });
        }
      }

      return new Response(JSON.stringify({ ok: true, direction, phone: formattedPhone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle message status updates (delivered, read)
    if (event === "messages.update" || event === "message.ack") {
      const updates = body.data || [body];
      for (const upd of Array.isArray(updates) ? updates : [updates]) {
        const waId = upd.key?.id || upd.id;
        const ack = upd.update?.status || upd.ack;
        if (waId && ack) {
          let status = "sent";
          if (ack === 2 || ack === "DELIVERY_ACK") status = "delivered";
          if (ack === 3 || ack === "READ") status = "read";
          
          await supabase
            .from("whatsapp_messages")
            .update({ status })
            .eq("wa_message_id", waId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
