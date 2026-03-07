import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  description: string | null;
  phone: string | null;
  address: string | null;
  is_open: boolean | null;
  avg_delivery_time_min: number | null;
  delivery_fee: number | null;
  min_order_value: number | null;
}

interface MenuHeaderProps {
  tenant: Tenant;
}

const MenuHeader = ({ tenant }: MenuHeaderProps) => {
  return (
    <div className="relative">
      {tenant.banner_url ? (
        <div className="h-48 sm:h-64 overflow-hidden">
          <img src={tenant.banner_url} alt={tenant.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,20%,7%)] via-[hsl(220,20%,7%)/0.4] to-transparent" />
        </div>
      ) : (
        <div className="h-48 sm:h-64 gradient-primary">
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(220,20%,7%)] via-transparent to-transparent" />
        </div>
      )}

      <div className="relative -mt-16 px-4 sm:px-6 max-w-2xl mx-auto">
        <div className="flex items-end gap-4">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt="" className="w-20 h-20 rounded-2xl border-4 border-[hsl(220,20%,7%)] object-cover shadow-lg" />
          ) : (
            <div className="w-20 h-20 rounded-2xl border-4 border-[hsl(220,20%,7%)] gradient-primary flex items-center justify-center shadow-lg">
              <span className="text-3xl font-display font-bold text-primary-foreground">{tenant.name[0]}</span>
            </div>
          )}
          <div className="pb-1">
            <h1 className="text-2xl font-display font-bold text-foreground">{tenant.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {tenant.is_open ? (
                <Badge className="bg-success text-success-foreground text-xs">Aberto</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">Fechado</Badge>
              )}
              {tenant.avg_delivery_time_min && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {tenant.avg_delivery_time_min} min
                </span>
              )}
            </div>
          </div>
        </div>
        {tenant.description && (
          <p className="text-sm text-muted-foreground mt-3">{tenant.description}</p>
        )}
      </div>
    </div>
  );
};

export default MenuHeader;
