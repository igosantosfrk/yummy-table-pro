-- WhatsApp Messages table for chat functionality
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  contact_phone text NOT NULL,
  contact_name text,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker')),
  content text,
  media_url text,
  media_mime_type text,
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  wa_message_id text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wa_messages_tenant_phone ON public.whatsapp_messages(tenant_id, contact_phone);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created ON public.whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_unread ON public.whatsapp_messages(tenant_id, is_read) WHERE is_read = false AND direction = 'incoming';

-- RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can manage their messages" ON public.whatsapp_messages
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- WhatsApp Conversations view (for conversation list)
CREATE OR REPLACE VIEW public.whatsapp_conversations AS
SELECT DISTINCT ON (m.tenant_id, m.contact_phone)
  m.tenant_id,
  m.contact_phone,
  m.contact_name,
  m.content AS last_message,
  m.direction AS last_direction,
  m.created_at AS last_message_at,
  (SELECT COUNT(*) FROM public.whatsapp_messages m2 
   WHERE m2.tenant_id = m.tenant_id 
   AND m2.contact_phone = m.contact_phone 
   AND m2.direction = 'incoming' 
   AND m2.is_read = false) AS unread_count
FROM public.whatsapp_messages m
ORDER BY m.tenant_id, m.contact_phone, m.created_at DESC;
