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
    name: '', description: '', price: '', category_id: '', 
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
        });
        // Load existing media
        loadMedia(editing.id);
      } else {
        setForm({ name: '', description: '', price: '', category_id: '', is_available: true, is_featured: false, prep_time_min: '30' });
        setMedia([]);
      }
    }
  }, [open, editing]);

  const loadMedia = async (productId: string) => {
    const { data } = await supabase
      .from('product_media' as any)
      .select('*')
      .eq('product_id', productId)
      .order('sort_order');
    if (data) {
      setMedia((data as any[]).map((m: any) => ({
        id: m.id,
        url: m.url,
        file_path: m.file_path || undefined,
        type: m.type as 'image' | 'video' | 'video_360',
        is_cover: m.is_cover ?? false,
        sort_order: m.sort_order ?? 0,
      })));
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
      await supabase.from('product_media').delete().eq('product_id', productId);

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
        await supabase.from('product_media').insert(mediaPayload);
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preço *</Label>
              <Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Tempo preparo (min)</Label>
              <Input type="number" value={form.prep_time_min} onChange={e => setForm({ ...form, prep_time_min: e.target.value })} />
            </div>
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
