
-- Table to track all page views on the public menu
CREATE TABLE public.menu_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  page_type text NOT NULL, -- 'menu_home', 'category', 'product', 'cart', 'checkout'
  page_ref_id text, -- category_id or product_id depending on page_type
  page_ref_name text, -- name of category/product for easy querying
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  utm_ad_link text,
  referrer text,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add UTM tracking columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_term text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_content text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS utm_ad_link text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS session_id text;

-- RLS for menu_page_views
ALTER TABLE public.menu_page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert page views (public menu)
CREATE POLICY "Anyone can insert page views"
ON public.menu_page_views FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Tenant members can view their page views
CREATE POLICY "Tenant members can view page views"
ON public.menu_page_views FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR tenant_id = get_user_tenant_id(auth.uid())
);

-- Index for performance
CREATE INDEX idx_menu_page_views_tenant_created ON public.menu_page_views(tenant_id, created_at DESC);
CREATE INDEX idx_menu_page_views_session ON public.menu_page_views(session_id);
CREATE INDEX idx_orders_utm_source ON public.orders(utm_source) WHERE utm_source IS NOT NULL;
