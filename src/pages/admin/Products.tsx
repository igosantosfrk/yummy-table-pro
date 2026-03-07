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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

  // Bulk delete state
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Resolve tenant and slug
  useEffect(() => {
    const resolveTenant = async () => {
      let tid = tenantId;
      if (!tid && isSuperAdmin) {
        const { data } = await supabase.from('tenants').select('id, slug').limit(1);
        if (data && data.length > 0) { tid = data[0].id; setTenantSlug(data[0].slug); }
      } else if (tid) {
        const { data } = await supabase.from('tenants').select('slug').eq('id', tid).single();
        if (data) setTenantSlug(data.slug);
      }
      if (tid) setActiveTenantId(tid);
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

  const handleBulkDeleteConfirm = async () => {
    if (!selectedCategoryId || !activeTenantId) return;
    setDeleting(true);
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('tenant_id', activeTenantId)
      .eq('category_id', selectedCategoryId);
    setDeleting(false);
    setConfirmDeleteOpen(false);
    setBulkDeleteOpen(false);
    setSelectedCategoryId('');
    if (error) {
      toast({ title: 'Erro ao excluir produtos', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Produtos excluídos com sucesso!' });
      fetchProducts();
    }
  };

  const selectedCategoryName = categories.find(c => c.id === selectedCategoryId)?.name || '';

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
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setBulkDeleteOpen(true)}
            variant="destructive"
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" /> Excluir todos os produtos
          </Button>
          {tenantSlug && (
            <Button
              onClick={() => window.open(`/${tenantSlug}`, '_blank')}
              className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
            >
              <ExternalLink className="h-4 w-4" /> Ver Cardápio
            </Button>
          )}
          <Button
            onClick={() => setImportOpen(true)}
            className="gap-2 gradient-primary text-white"
          >
            <FileSpreadsheet className="h-4 w-4" /> Importar em lote
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

      {/* Dialog para selecionar categoria */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir todos os produtos de uma categoria</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Selecione a categoria da qual deseja excluir todos os produtos:</p>
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setSelectedCategoryId(''); }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!selectedCategoryId}
              onClick={() => { setBulkDeleteOpen(false); setConfirmDeleteOpen(true); }}
            >
              Prosseguir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação final */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os produtos da categoria <strong>"{selectedCategoryName}"</strong> serão excluídos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmDeleteOpen(false); setSelectedCategoryId(''); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir tudo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
