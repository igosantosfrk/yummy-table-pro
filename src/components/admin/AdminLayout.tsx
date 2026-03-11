import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, FolderOpen, ShoppingBag, Truck, Settings,
  MessageSquare, CreditCard, LogOut, Menu, X, UtensilsCrossed, ChevronRight,
  Shield, Megaphone
} from 'lucide-react';

const menuItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/orders', label: 'Pedidos', icon: ShoppingBag },
  { path: '/admin/products', label: 'Produtos', icon: Package },
  { path: '/admin/categories', label: 'Categorias', icon: FolderOpen },
  { path: '/admin/delivery', label: 'Delivery', icon: Truck },
  { path: '/admin/payments', label: 'Financeiro', icon: CreditCard },
  { path: '/admin/marketing', label: 'Marketing', icon: Megaphone },
  { path: '/admin/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { path: '/admin/settings', label: 'Configurações', icon: Settings },
];

const superAdminItem = { path: '/admin/super', label: 'Super Admin', icon: Shield };

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, isSuperAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background dark">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-sidebar-foreground text-lg">Menu Digital</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto lg:hidden text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {isSuperAdmin && (() => {
            const isActive = location.pathname === superAdminItem.path;
            return (
              <Link
                to={superAdminItem.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-warning/20 text-warning shadow-glow-sm"
                    : "text-warning/80 hover:bg-warning/10 hover:text-warning"
                )}
              >
                <superAdminItem.icon className="h-4 w-4" />
                {superAdminItem.label}
              </Link>
            );
          })()}

          <div className="h-px bg-sidebar-border my-2" />

          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground text-sm font-semibold">
              {profile?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-muted-foreground truncate">Administrador</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Top bar */}
        <header className="h-16 border-b border-border flex items-center px-4 lg:px-6 gap-4 bg-background/80 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-display font-semibold text-foreground">
            {location.pathname === '/admin/super' ? 'Super Admin' : menuItems.find(i => i.path === location.pathname)?.label || 'Admin'}
          </h2>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
