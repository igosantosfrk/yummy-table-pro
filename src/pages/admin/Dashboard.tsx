import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import DateRangeFilter from '@/components/admin/DateRangeFilter';
import { useDateRange } from '@/hooks/useDateRange';
import { useDashboardData } from '@/hooks/useDashboardData';
import KPICards from '@/components/admin/dashboard/KPICards';
import WeeklySalesChart from '@/components/admin/dashboard/WeeklySalesChart';
import FunnelChart from '@/components/admin/dashboard/FunnelChart';
import TopCustomersChart from '@/components/admin/dashboard/TopCustomersChart';
import CampaignSalesChart from '@/components/admin/dashboard/CampaignSalesChart';
import AdSalesTable from '@/components/admin/dashboard/AdSalesTable';

const Dashboard = () => {
  const { profile } = useAuth();
  const { preset, setPreset, dateRange, customRange, setCustomRange } = useDateRange('today');
  const { kpis, weeklySales, funnel, topCustomers, campaignSales, adSales, loading } = useDashboardData(profile?.tenant_id, dateRange);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Olá, {profile?.full_name?.split(' ')[0] || 'Admin'} 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Painel de performance do seu restaurante
          </p>
        </motion.div>
        <DateRangeFilter
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />
      </div>

      {/* KPI Cards */}
      <KPICards kpis={kpis} />

      {/* Charts Row 1: Weekly Sales + Funnel */}
      <div className="grid lg:grid-cols-2 gap-4">
        <WeeklySalesChart data={weeklySales} loading={loading} />
        <FunnelChart data={funnel} loading={loading} />
      </div>

      {/* Charts Row 2: Top Customers + Campaign Sales */}
      <div className="grid lg:grid-cols-2 gap-4">
        <TopCustomersChart data={topCustomers} loading={loading} />
        <CampaignSalesChart data={campaignSales} loading={loading} />
      </div>

      {/* Ad Sales Table */}
      <AdSalesTable data={adSales} loading={loading} />
    </div>
  );
};

export default Dashboard;
