
CREATE TABLE public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('meta', 'google')),
  access_token text NOT NULL,
  account_id text NOT NULL,
  account_name text,
  is_active boolean DEFAULT true,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, platform)
);

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can manage their ad accounts"
ON public.ad_accounts
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR (tenant_id = get_user_tenant_id(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR (tenant_id = get_user_tenant_id(auth.uid()))
);
