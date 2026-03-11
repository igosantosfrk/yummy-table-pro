
-- Coupons table
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0,
  min_order_value numeric DEFAULT 0,
  max_uses integer DEFAULT null,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage coupons"
  ON public.coupons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (tenant_id = get_user_tenant_id(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR (tenant_id = get_user_tenant_id(auth.uid())));

CREATE POLICY "Public can view active coupons by code"
  ON public.coupons FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- WhatsApp message templates table
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'reactivation',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage templates"
  ON public.whatsapp_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role) OR (tenant_id = get_user_tenant_id(auth.uid())))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) OR (tenant_id = get_user_tenant_id(auth.uid())));

-- Add coupon_code to orders for tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_code text DEFAULT null;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount numeric DEFAULT 0;
