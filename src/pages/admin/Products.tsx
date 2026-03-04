import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Package, Search, FileSpreadsheet, ExternalLink } from 'lucide-react';
import ProductFormDialog from '@/components/admin/products/ProductFormDialog';
import BulkImportDialog from '@/components/admin/products/BulkImportDialog';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image_url: string | null;
  is_available: boolean | null;
  is_featured: boolean | null;
  prep_time_min: number | null;
}

interface Category {
  id: string;
  name: string;
}

const Products = () => {
  const { tenantId, isSuperAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  // For super_admin without tenant, fetch first tenant
  useEffect(() => {
    const resolveTenant = async () => {
      if (tenantId) {
        setActiveTenantId(tenantId);
      } else if (isSuperAdmin) {
        const { data } = await supabase.from('tenants').select('id').limit(1);
        if (data && data.length > 0) setActiveTenantId(data[0].id);
      }
    };
    resolveTenant();
  }, [tenantId, isSuperAdmin]);

  const fetchProducts = async () => {
    if (!activeTenantId) return;
    const { data } = await supabase.from('products').select('*').eq('tenant_id', activeTenantId).order('sort_order');
    setProducts(data || []);
  };

  const fetchCategories = async () => {
    if (!activeTenantId) return;
    const { data } = await supabase.from('categories').select('id, name').eq('tenant_id', activeTenantId).eq('is_active', true).order('sort_order');
    setCategories(data || []);
  };

  useEffect(() => { fetchProducts(); fetchCategories(); }, [activeTenantId]);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setDialogOpen(true); };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao excluir', variant: 'destructive' }); return; }
    toast({ title: 'Produto excluído!' });
    fetchProducts();
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    await supabase.from('products').update({ is_available: !current }).eq('id', id);
    fetchProducts();
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (!activeTenantId) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Produtos</h1>
          <p className="text-muted-foreground">{products.length} produtos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
          >
            <FileSpreadsheet className="h-4 w-4 text-primary" /> Importar em lote
          </Button>
          <Button onClick={openCreate} className="gradient-primary text-white">
            <Plus className="h-4 w-4 mr-2" /> Novo Produto
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar produtos..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Card className="glass">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum produto encontrado</p>
            <p className="text-sm text-muted-foreground">Comece adicionando seu primeiro produto</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="glass overflow-hidden group hover:shadow-glow-sm transition-all">
                {p.image_url && (
                  <div className="h-40 bg-muted overflow-hidden">
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
                    </div>
                    <span className="text-lg font-bold text-primary whitespace-nowrap">R$ {p.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={p.is_available ?? true} onCheckedChange={() => toggleAvailability(p.id, p.is_available ?? true)} />
                      <span className="text-xs text-muted-foreground">{p.is_available ? 'Disponível' : 'Indisponível'}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tenantId={activeTenantId}
        editing={editing}
        categories={categories}
        onSaved={fetchProducts}
      />
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        tenantId={activeTenantId}
        categories={categories}
        onImported={fetchProducts}
      />
    </div>
  );
};

export default Products;
