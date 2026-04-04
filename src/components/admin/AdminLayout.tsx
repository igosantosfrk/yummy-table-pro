import ErrorBoundary from "@/components/ErrorBoundary";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, Package, FolderOpen, ShoppingBag, Settings,
  MessageSquare, CreditCard, LogOut, Menu, X, UtensilsCrossed,
  Shield, Megaphone, Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const menuItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/orders', label: 'Pedidos', icon: ShoppingBag },
  { path: '/admin/customers', label: 'Clientes', icon: Users },
  { path: '/admin/products', label: 'Produtos', icon: Package },
  { path: '/admin/categories', label: 'Categorias', icon: FolderOpen },
  { path: '/admin/payments', label: 'Financeiro', icon: CreditCard },
  { path: '/admin/marketing', label: 'Marketing', icon: Megaphone },
  { path: '/admin/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { path: '/admin/settings', label: 'Configurações', icon: Settings },
];

const superAdminItem = { path: '/admin/super', label: 'Super Admin', icon: Shield };

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, isSuperAdmin, signOut, tenantId } = useAuth();
  const [waUnread, setWaUnread] = useState(0);

  useEffect(() => {
    if (!tenantId) return;
    const fetchUnread = async () => {
      const { count } = await supabase.from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('direction', 'incoming').eq('is_read', false);
      setWaUnread(count || 0);
    };
    fetchUnread();
    const ch = supabase.channel('wa-unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId]);
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#f8f9fb] text-foreground">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200/80 flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 shadow-sm",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-gray-800 text-lg">Menu Maestro</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden text-gray-500" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {isSuperAdmin && (() => {
            const isActive = location.pathname === superAdminItem.path;
            return (
              <Link to={superAdminItem.path} onClick={() => setSidebarOpen(false)}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive ? "bg-amber-50 text-amber-700 shadow-sm border border-amber-100" : "text-amber-600 hover:bg-amber-50/50 hover:text-amber-700"
                )}>
                <superAdminItem.icon className="h-4 w-4" />
                {superAdminItem.label}
              </Link>
            );
          })()}
          {isSuperAdmin && <div className="h-px bg-gray-100 my-2" />}
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive ? "bg-primary/10 text-primary shadow-sm border border-primary/10" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                )}>
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.path === '/admin/whatsapp' && waUnread > 0 && (
                  <Badge className="ml-auto bg-primary text-white text-[10px] px-1.5 py-0 h-4 min-w-4">{waUnread}</Badge>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{profile?.full_name || 'Usuário'}</p>
              <p className="text-xs text-gray-400 truncate">Administrador</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-gray-500 hover:text-red-600 hover:bg-red-50">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0">
        <header className="h-16 border-b border-gray-200/80 flex items-center px-4 lg:px-6 gap-4 bg-white/80 backdrop-blur-sm">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-display font-semibold text-gray-800">
            {menuItems.find(i => i.path === location.pathname)?.label || 'Admin'}
          </h2>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
