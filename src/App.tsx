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
import Delivery from "@/pages/admin/Delivery";
import Payments from "@/pages/admin/Payments";
import WhatsApp from "@/pages/admin/WhatsApp";
import AdminSettings from "@/pages/admin/AdminSettings";
import Marketing from "@/pages/admin/Marketing";
import PublicMenu from "@/pages/menu/PublicMenu";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Admin Panel - both super_admin and tenant_admin */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="tenant_admin"><AdminLayout /></ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="orders" element={<Orders />} />
              <Route path="delivery" element={<Delivery />} />
              <Route path="payments" element={<Payments />} />
              <Route path="whatsapp" element={<WhatsApp />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="super" element={
                <ProtectedRoute requiredRole="super_admin"><SuperAdmin /></ProtectedRoute>
              } />
            </Route>

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
