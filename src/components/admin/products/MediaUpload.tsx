import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ImagePlus, Video, X, Loader2, Star } from 'lucide-react';

interface MediaItem {
  id?: string;
  url: string;
  file_path?: string;
  type: 'image' | 'video' | 'video_360';
  is_cover: boolean;
  sort_order: number;
}

interface MediaUploadProps {
  tenantId: string;
  productId?: string;
  media: MediaItem[];
  onChange: (media: MediaItem[]) => void;
}

const MediaUpload = ({ tenantId, productId, media, onChange }: MediaUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File, type: 'image' | 'video' | 'video_360') => {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const folder = type === 'image' ? 'images' : 'videos';
    const path = `${tenantId}/products/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from('tenant-assets').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
    const newItem: MediaItem = {
      url: urlData.publicUrl,
      file_path: path,
      type,
      is_cover: media.length === 0,
      sort_order: media.length,
    };

    onChange([...media, newItem]);
    setUploading(false);
  };

  const handleFiles = async (files: FileList | null, type: 'image' | 'video' | 'video_360') => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await upload(file, type);
    }
  };

  const remove = async (index: number) => {
    const item = media[index];
    if (item.file_path) {
      await supabase.storage.from('tenant-assets').remove([item.file_path]);
    }
    const updated = media.filter((_, i) => i !== index);
    if (item.is_cover && updated.length > 0) {
      updated[0].is_cover = true;
    }
    onChange(updated);
  };

  const setCover = (index: number) => {
    const updated = media.map((m, i) => ({ ...m, is_cover: i === index }));
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files, 'image'); e.target.value = ''; }}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files, 'video'); e.target.value = ''; }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => imageRef.current?.click()} disabled={uploading} className="gap-1">
          <ImagePlus className="h-4 w-4" /> Imagens
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => videoRef.current?.click()} disabled={uploading} className="gap-1">
          <Video className="h-4 w-4" /> Vídeo
        </Button>
        {uploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {media.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {media.map((item, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-muted">
              {item.type === 'image' ? (
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <video src={item.url} className="w-full h-full object-cover" muted />
              )}
              {item.is_cover && (
                <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                  <Star className="h-3 w-3" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {!item.is_cover && item.type === 'image' && (
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-primary" onClick={() => setCover(i)}>
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-white hover:text-destructive" onClick={() => remove(i)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {media.length === 0 && (
        <div
          onClick={() => imageRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
        >
          <ImagePlus className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">Adicione fotos e vídeos do produto</p>
        </div>
      )}
    </div>
  );
};

export default MediaUpload;
