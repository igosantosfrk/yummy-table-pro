import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UtmParams {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  utm_ad_link: string | null;
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function getOrCreateSessionId(): string {
  const key = 'menu_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

function extractUtmParams(): UtmParams {
  const params = new URLSearchParams(window.location.search);
  const utmParams: UtmParams = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
    utm_ad_link: params.get('utm_ad_link') || params.get('ad_link'),
  };

  // Persist UTMs in sessionStorage so they survive navigation
  const storageKey = 'menu_utm_params';
  const hasAny = Object.values(utmParams).some(v => v !== null);
  if (hasAny) {
    sessionStorage.setItem(storageKey, JSON.stringify(utmParams));
    return utmParams;
  }

  // Fallback to stored UTMs
  const stored = sessionStorage.getItem(storageKey);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* ignore */ }
  }

  return utmParams;
}

export function useMenuTracking(tenantId: string | null) {
  const sessionId = useRef(getOrCreateSessionId());
  const [utmParams] = useState<UtmParams>(() => extractUtmParams());

  const trackPageView = useCallback(async (
    pageType: string,
    pageRefId?: string,
    pageRefName?: string,
  ) => {
    if (!tenantId) return;

    try {
      await supabase.from('menu_page_views' as any).insert({
        tenant_id: tenantId,
        session_id: sessionId.current,
        page_type: pageType,
        page_ref_id: pageRefId || null,
        page_ref_name: pageRefName || null,
        utm_source: utmParams.utm_source,
        utm_medium: utmParams.utm_medium,
        utm_campaign: utmParams.utm_campaign,
        utm_term: utmParams.utm_term,
        utm_content: utmParams.utm_content,
        utm_ad_link: utmParams.utm_ad_link,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent || null,
      } as any);
    } catch (err) {
      console.error('Tracking error:', err);
    }
  }, [tenantId, utmParams]);

  // Track initial menu home view
  useEffect(() => {
    if (tenantId) {
      trackPageView('menu_home');
    }
  }, [tenantId, trackPageView]);

  return {
    sessionId: sessionId.current,
    utmParams,
    trackPageView,
  };
}
