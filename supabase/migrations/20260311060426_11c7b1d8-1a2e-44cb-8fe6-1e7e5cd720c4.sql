
-- Customers table to centralize all customers from orders
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  neighborhood text,
  city text,
  notes text,
  tags text[] DEFAULT '{}',
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  avg_ticket numeric NOT NULL DEFAULT 0,
  last_order_at timestamp with time zone,
  first_order_at timestamp with time zone,
  loyalty_points integer NOT NULL DEFAULT 0,
  loyalty_tier text DEFAULT 'bronze',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- RLS: tenant members can manage their customers
CREATE POLICY "Tenant members can manage customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR tenant_id = get_user_tenant_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR tenant_id = get_user_tenant_id(auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to upsert customer from order data
CREATE OR REPLACE FUNCTION public.upsert_customer_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_orders integer;
  v_total_spent numeric;
  v_first_order timestamp with time zone;
  v_last_order timestamp with time zone;
BEGIN
  -- Calculate aggregates
  SELECT 
    COUNT(*),
    COALESCE(SUM(total), 0),
    MIN(created_at),
    MAX(created_at)
  INTO v_total_orders, v_total_spent, v_first_order, v_last_order
  FROM public.orders
  WHERE tenant_id = NEW.tenant_id 
    AND customer_phone = NEW.customer_phone
    AND status != 'cancelled';

  INSERT INTO public.customers (
    tenant_id, name, phone, email, address, neighborhood, city,
    total_orders, total_spent, avg_ticket, first_order_at, last_order_at
  ) VALUES (
    NEW.tenant_id, NEW.customer_name, NEW.customer_phone, NEW.customer_email,
    NEW.delivery_address, NEW.delivery_neighborhood, NEW.delivery_city,
    v_total_orders, v_total_spent,
    CASE WHEN v_total_orders > 0 THEN v_total_spent / v_total_orders ELSE 0 END,
    v_first_order, v_last_order
  )
  ON CONFLICT (tenant_id, phone) DO UPDATE SET
    name = EXCLUDED.name,
    email = COALESCE(EXCLUDED.email, customers.email),
    address = COALESCE(EXCLUDED.address, customers.address),
    neighborhood = COALESCE(EXCLUDED.neighborhood, customers.neighborhood),
    city = COALESCE(EXCLUDED.city, customers.city),
    total_orders = EXCLUDED.total_orders,
    total_spent = EXCLUDED.total_spent,
    avg_ticket = EXCLUDED.avg_ticket,
    last_order_at = EXCLUDED.last_order_at,
    first_order_at = COALESCE(customers.first_order_at, EXCLUDED.first_order_at);

  RETURN NEW;
END;
$$;

-- Trigger on orders to auto-upsert customer
CREATE TRIGGER upsert_customer_on_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION upsert_customer_from_order();
