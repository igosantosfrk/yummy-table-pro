
ALTER TABLE public.tenants 
  ADD COLUMN stripe_secret_key text,
  ADD COLUMN stripe_publishable_key text;
