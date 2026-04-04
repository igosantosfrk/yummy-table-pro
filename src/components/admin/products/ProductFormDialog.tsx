import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MediaUpload from './MediaUpload';

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
  cost_price?: number | null;
}

interface MediaItem {
  id?: string;
  url: string;
  file_path?: string;
  type: 'image' | 'video' | 'video_360';
  is_cover: boolean;
  sort_order: number;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  editing: Product | null;
  categories: { id: string; name: string }[];
  onSaved: () => void;
}

const ProductFormDialog = ({ open, onOpenChange, tenantId, editing, categories, onSaved }: ProductFormDialogProps) => {
  const [form, setForm] = useState({
    name: '', description: '', price: '', cost_price: '', category_id: '', 
    is_available: true, is_featured: false, prep_time_min: '30',
  });
  const [media, setMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          description: editing.description || '',
          price: String(editing.price),
          category_id: editing.category_id || '',
          is_available: editing.is_available ?? true,
          is_featured: editing.is_featured ?? false,
          prep_time_min: String(editing.prep_time_min || 30),
          cost_price: String(editing.cost_price || ''),
        });
        // Load existing media
        loadMedia(editing.id);
      } else {
        setForm({ name: '', description: '', price: '', cost_price: '', category_id: '', is_available: true, is_featured: false, prep_time_min: '30' });
        setMedia([]);
      }
    }
  }, [open, editing]);

  const loadMedia = async (productId: string) => {
    try {
      const { data } = await supabase
        .from('product_media' as any)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');
      if (data && (data as any[]).length > 0) {
        setMedia((data as any[]).map((m: any) => ({
          id: m.id,
          url: m.url,
          file_path: m.file_path || undefined,
          type: m.type as 'image' | 'video' | 'video_360',
          is_cover: m.is_cover ?? false,
          sort_order: m.sort_order ?? 0,
        })));
        return;
      }
    } catch {
      // product_media table may not exist yet
    }
    // Fallback: use existing image_url from the product
    if (editing?.image_url) {
      setMedia([{
        url: editing.image_url,
        type: 'image',
        is_cover: true,
        sort_order: 0,
      }]);
    }
  };

  const handleSave = async () => {
    if (!tenantId || !form.name || !form.price) {
      toast({ title: 'Preencha nome e preço', variant: 'destructive' });
      return;
    }

    const coverMedia = media.find(m => m.is_cover && m.type === 'image');

    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      cost_price: form.cost_price ? parseFloat(form.cost_price) : 0,
      category_id: form.category_id || null,
      image_url: coverMedia?.url || null,
      is_available: form.is_available,
      is_featured: form.is_featured,
      prep_time_min: parseInt(form.prep_time_min) || 30,
    };

    let productId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return; }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select('id').single();
      if (error) { toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' }); return; }
      productId = data.id;
    }

    // Sync media records
    if (productId) {
      // Delete existing media records
      await supabase.from('product_media' as any).delete().eq('product_id', productId);

      // Insert current media
      if (media.length > 0) {
        const mediaPayload = media.map((m, i) => ({
          product_id: productId!,
          tenant_id: tenantId,
          type: m.type,
          url: m.url,
          file_path: m.file_path || null,
          sort_order: i,
          is_cover: m.is_cover,
        }));
        await (supabase.from('product_media' as any) as any).insert(mediaPayload);
      }
    }

    toast({ title: editing ? 'Produto atualizado!' : 'Produto criado!' });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pizza Margherita" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Descrição do produto" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Preço de Custo (R$)</Label>
              <Input type="number" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Preço de Venda (R$) *</Label>
              <Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Margem de Lucro</Label>
              {(() => {
                const cost = parseFloat(form.cost_price) || 0;
                const price = parseFloat(form.price) || 0;
                const margin = price - cost;
                const pct = price > 0 ? (margin / price) * 100 : 0;
                const isPositive = margin > 0;
                const isNegative = margin < 0;
                const colorClass = isPositive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isNegative ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-500 border-gray-200";
                const label = cost > 0 ? "R$ " + margin.toFixed(2) + " (" + pct.toFixed(1) + "%)" : "—";
                return (
                  <div className={"flex items-center justify-center h-10 rounded-md border text-sm font-semibold " + colorClass}>
                    {label}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tempo preparo (min)</Label>
            <Input type="number" value={form.prep_time_min} onChange={e => setForm({ ...form, prep_time_min: e.target.value })} className="max-w-[120px]" />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mídias do Produto</Label>
            <MediaUpload tenantId={tenantId} productId={editing?.id} media={media} onChange={setMedia} />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_available} onCheckedChange={v => setForm({ ...form, is_available: v })} />
              <Label>Disponível</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_featured} onCheckedChange={v => setForm({ ...form, is_featured: v })} />
              <Label>Destaque</Label>
            </div>
          </div>
          <Button onClick={handleSave} className="w-full gradient-primary text-white">
            {editing ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductFormDialog;
