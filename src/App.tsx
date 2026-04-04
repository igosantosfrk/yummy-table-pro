import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/admin/AdminLayout";
import Login from "@/pages/Login";
import SuperAdmin from "@/pages/SuperAdmin";
import Dashboard from "@/pages/admin/Dashboard";
import Products from "@/pages/admin/Products";
import Categories from "@/pages/admin/Categories";
import Orders from "@/pages/admin/Orders";
import Payments from "@/pages/admin/Payments";
import WhatsApp from "@/pages/admin/WhatsApp";
import AdminSettings from "@/pages/admin/AdminSettings";
import Marketing from "@/pages/admin/Marketing";
import Customers from "@/pages/admin/Customers";
import PublicMenu from "@/pages/menu/PublicMenu";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AdminPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requiredRole="tenant_admin">
    <AdminLayout>{children}</AdminLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Admin Panel */}
            <Route path="/admin" element={<AdminPage><Dashboard /></AdminPage>} />
            <Route path="/admin/products" element={<AdminPage><Products /></AdminPage>} />
            <Route path="/admin/categories" element={<AdminPage><Categories /></AdminPage>} />
            <Route path="/admin/orders" element={<AdminPage><Orders /></AdminPage>} />
            <Route path="/admin/customers" element={<AdminPage><Customers /></AdminPage>} />
            <Route path="/admin/payments" element={<AdminPage><Payments /></AdminPage>} />
            <Route path="/admin/marketing" element={<AdminPage><Marketing /></AdminPage>} />
            <Route path="/admin/whatsapp" element={<AdminPage><WhatsApp /></AdminPage>} />
            <Route path="/admin/settings" element={<AdminPage><AdminSettings /></AdminPage>} />
            <Route path="/admin/super" element={
              <ProtectedRoute requiredRole="tenant_admin">
                <AdminLayout>
                  <ProtectedRoute requiredRole="super_admin"><SuperAdmin /></ProtectedRoute>
                </AdminLayout>
              </ProtectedRoute>
            } />

            {/* Public Menu */}
            <Route path="/:slug" element={<PublicMenu />} />

            {/* Redirect root to login */}
            <Route path="/" element={<Login />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
