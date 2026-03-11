import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface MetaCampaign {
  id: string
  name: string
  status: string
  insights?: { data: Array<{ spend: string; impressions: string; clicks: string; actions?: Array<{ action_type: string; value: string }> }> }
}

interface GoogleCampaign {
  campaign: { id: string; name: string; status: string }
  metrics: { costMicros: string; impressions: string; clicks: string; conversions: number }
}

async function fetchMetaCampaigns(accessToken: string, accountId: string) {
  const cleanAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`
  
  const url = `https://graph.facebook.com/v21.0/${cleanAccountId}/campaigns?fields=id,name,status,insights{spend,impressions,clicks,actions}&filtering=[{"field":"effective_status","operator":"IN","value":["ACTIVE"]}]&access_token=${accessToken}`
  
  const response = await fetch(url)
  const data = await response.json()
  
  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message}`)
  }

  // Also fetch account-level spend
  const accountUrl = `https://graph.facebook.com/v21.0/${cleanAccountId}/insights?fields=spend,impressions,clicks,actions&date_preset=today&access_token=${accessToken}`
  const accountResponse = await fetch(accountUrl)
  const accountData = await accountResponse.json()

  const totalSpendToday = accountData.data?.[0]?.spend ? parseFloat(accountData.data[0].spend) : 0

  const campaigns = (data.data || []).map((c: MetaCampaign) => {
    const insight = c.insights?.data?.[0]
    const spend = insight?.spend ? parseFloat(insight.spend) : 0
    const impressions = insight?.impressions ? parseInt(insight.impressions) : 0
    const clicks = insight?.clicks ? parseInt(insight.clicks) : 0
    const results = insight?.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase' || a.action_type === 'lead')
    const resultCount = results ? parseInt(results.value) : 0

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      platform: 'meta',
      spend,
      impressions,
      clicks,
      results: resultCount,
      cost_per_result: resultCount > 0 ? spend / resultCount : 0,
    }
  })

  return { campaigns, totalSpendToday }
}

async function fetchGoogleCampaigns(accessToken: string, customerId: string) {
  const cleanCustomerId = customerId.replace(/-/g, '')
  
  const query = `SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date DURING TODAY`
  
  const url = `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/googleAds:searchStream`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'developer-token': 'test', // placeholder
    },
    body: JSON.stringify({ query }),
  })
  
  const data = await response.json()
  
  if (data.error) {
    throw new Error(`Google Ads API Error: ${data.error.message}`)
  }

  let totalSpendToday = 0
  const campaigns = (data[0]?.results || []).map((r: GoogleCampaign) => {
    const spend = r.metrics?.costMicros ? parseInt(r.metrics.costMicros) / 1_000_000 : 0
    totalSpendToday += spend
    const impressions = r.metrics?.impressions ? parseInt(r.metrics.impressions) : 0
    const clicks = r.metrics?.clicks ? parseInt(r.metrics.clicks) : 0
    const results = r.metrics?.conversions || 0

    return {
      id: r.campaign.id,
      name: r.campaign.name,
      status: r.campaign.status,
      platform: 'google',
      spend,
      impressions,
      clicks,
      results,
      cost_per_result: results > 0 ? spend / results : 0,
    }
  })

  return { campaigns, totalSpendToday }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    // Get tenant_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()
    
    if (!profile?.tenant_id) throw new Error('No tenant found')

    // Get ad accounts for this tenant
    const { data: adAccounts } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)

    const allCampaigns: any[] = []
    let totalSpend = 0
    const errors: any[] = []

    for (const account of (adAccounts || [])) {
      try {
        if (account.platform === 'meta') {
          const result = await fetchMetaCampaigns(account.access_token, account.account_id)
          allCampaigns.push(...result.campaigns)
          totalSpend += result.totalSpendToday
        } else if (account.platform === 'google') {
          const result = await fetchGoogleCampaigns(account.access_token, account.account_id)
          allCampaigns.push(...result.campaigns)
          totalSpend += result.totalSpendToday
        }

        // Update last_synced_at
        await supabase
          .from('ad_accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', account.id)

      } catch (e) {
        errors.push({ platform: account.platform, error: e.message })
      }
    }

    // Get today's revenue from orders for ROI calculation
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total, utm_source, utm_campaign')
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', today.toISOString())

    const totalRevenue = (todayOrders || []).reduce((sum, o) => sum + (o.total || 0), 0)
    const totalOrders = (todayOrders || []).length
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0

    // Revenue per campaign (based on utm_campaign matching)
    const revenueBySource: Record<string, number> = {}
    const ordersBySource: Record<string, number> = {}
    for (const order of (todayOrders || [])) {
      const key = order.utm_source || 'organic'
      revenueBySource[key] = (revenueBySource[key] || 0) + (order.total || 0)
      ordersBySource[key] = (ordersBySource[key] || 0) + 1
    }

    // Enrich campaigns with internal ROI data
    const enrichedCampaigns = allCampaigns.map(c => {
      const source = c.platform === 'meta' ? 'facebook' : 'google'
      const campaignRevenue = revenueBySource[source] || 0
      const campaignOrders = ordersBySource[source] || 0
      const campaignRoi = c.spend > 0 ? ((campaignRevenue - c.spend) / c.spend) * 100 : 0

      return {
        ...c,
        revenue: campaignRevenue,
        orders: campaignOrders,
        roi: campaignRoi,
      }
    })

    return new Response(JSON.stringify({
      campaigns: enrichedCampaigns,
      summary: {
        total_spend: totalSpend,
        total_revenue: totalRevenue,
        total_orders: totalOrders,
        roi,
      },
      errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
