import { Clock, MapPin, Bike, Star } from 'lucide-react';

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
      {/* Banner */}
      {tenant.banner_url ? (
        <div className="h-48 sm:h-56 overflow-hidden">
          <img src={tenant.banner_url} alt={tenant.name} className="w-full h-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f5f5f7] via-[#f5f5f7]/30 to-transparent" />
        </div>
      ) : (
        <div className="h-32 sm:h-40 bg-gradient-to-br from-orange-400 via-orange-500 to-red-500">
          <div className="absolute inset-0 bg-gradient-to-t from-[#f5f5f7] via-transparent to-transparent" />
        </div>
      )}

      {/* Store Info Card */}
      <div className="relative -mt-14 px-4 sm:px-6 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl p-5 shadow-[0_2px_20px_rgba(0,0,0,0.08)] border border-gray-100/80">
          <div className="flex items-start gap-4">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-md ring-2 ring-white flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-2xl font-bold text-white">{tenant.name[0]}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 truncate">{tenant.name}</h1>
                {tenant.is_open ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Aberto
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-500 border border-red-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Fechado
                  </span>
                )}
              </div>
              {tenant.description && (
                <p className="text-[13px] text-gray-500 mt-1 line-clamp-2">{tenant.description}</p>
              )}
            </div>
          </div>

          {/* Delivery Info Pills */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
            {tenant.avg_delivery_time_min && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50/80 text-gray-700 whitespace-nowrap">
                <Clock className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-semibold">{tenant.avg_delivery_time_min}-{tenant.avg_delivery_time_min + 15} min</span>
              </div>
            )}
            {tenant.delivery_fee != null && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50/80 text-gray-700 whitespace-nowrap">
                <Bike className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-semibold">
                  {tenant.delivery_fee === 0 ? (
                    <span className="text-emerald-600">Entrega Grátis</span>
                  ) : (
                    <>Entrega R$ {tenant.delivery_fee.toFixed(2)}</>
                  )}
                </span>
              </div>
            )}
            {tenant.min_order_value != null && tenant.min_order_value > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50/80 text-gray-700 whitespace-nowrap">
                <Star className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-semibold">Mín. R$ {tenant.min_order_value.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuHeader;
