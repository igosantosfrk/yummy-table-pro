
-- Loyalty programs table
CREATE TABLE public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  points_per_real numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Loyalty rewards catalog
CREATE TABLE public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  reward_type text NOT NULL DEFAULT 'cashback',
  reward_value numeric NOT NULL DEFAULT 0,
  points_required integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Loyalty transactions (points earned/redeemed)
CREATE TABLE public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  program_id uuid REFERENCES public.loyalty_programs(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reward_id uuid REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'earn',
  points integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Coupon usage tracking
CREATE TABLE public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_applied numeric NOT NULL DEFAULT 0,
  order_total numeric NOT NULL DEFAULT 0,
  used_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant members can manage loyalty programs" ON public.loyalty_programs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can manage loyalty rewards" ON public.loyalty_rewards
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can manage loyalty transactions" ON public.loyalty_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant members can manage coupon usage" ON public.coupon_usage
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR tenant_id = get_user_tenant_id(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
