-- Add birthday to customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday date;

-- Create whatsapp_campaigns table for automation rules
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'manual', -- 'birthday', 'inactive', 'periodic', 'manual'
  template_message text NOT NULL,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  -- For inactive campaigns
  inactive_days integer DEFAULT 30,
  -- For periodic campaigns
  frequency text, -- 'weekly', 'biweekly', 'monthly'
  send_day integer, -- day of week (0=Sun) or day of month
  send_hour integer DEFAULT 9, -- hour to send (0-23)
  -- AI personalization
  use_ai_personalization boolean DEFAULT false,
  -- Stats
  total_sent integer NOT NULL DEFAULT 0,
  last_sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Campaign send log
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_phone text NOT NULL,
  message_sent text NOT NULL,
  status text NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'delivered'
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage campaigns" ON public.whatsapp_campaigns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (tenant_id = get_user_tenant_id(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR (tenant_id = get_user_tenant_id(auth.uid())));

CREATE POLICY "Tenant members can manage campaign logs" ON public.whatsapp_campaign_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (tenant_id = get_user_tenant_id(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR (tenant_id = get_user_tenant_id(auth.uid())));

-- Updated_at trigger
CREATE TRIGGER update_whatsapp_campaigns_updated_at
  BEFORE UPDATE ON public.whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();