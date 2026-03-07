import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  categories: { id: string; name: string }[];
  onImported: () => void;
}

interface ImportRow {
  nome: string;
  descricao?: string;
  preco: string | number;
  categoria?: string;
  disponivel?: string;
  destaque?: string;
  tempo_preparo?: string | number;
}

const BulkImportDialog = ({ open, onOpenChange, tenantId, categories, onImported }: BulkImportDialogProps) => {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setRows([]);
    setProgress(0);
    setResults(null);
    setSelectedCategoryId('');
  };

  const parseFile = (file: File) => {
    reset();
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse<ImportRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => setRows(result.data),
        error: () => toast({ title: 'Erro ao ler CSV', variant: 'destructive' }),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<ImportRow>(sheet);
        setRows(data);
      };
      reader.readAsBinaryString(file);
    } else {
      toast({ title: 'Formato não suportado. Use CSV ou Excel.', variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    setProgress(0);
    const errors: string[] = [];
    let success = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row.nome || '').trim();
      const price = parseFloat(String(row.preco || '0').replace(',', '.'));

      if (!name || isNaN(price) || price <= 0) {
        errors.push(`Linha ${i + 2}: Nome ou preço inválido (${name})`);
        setProgress(Math.round(((i + 1) / rows.length) * 100));
        continue;
      }

      const catName = String(row.categoria || '').trim().toLowerCase();
      const category = categories.find(c => c.name.toLowerCase() === catName);

      const { error } = await supabase.from('products').insert({
        tenant_id: tenantId,
        name,
        description: String(row.descricao || '').trim() || null,
        price,
        category_id: category?.id || null,
        is_available: row.disponivel?.toLowerCase() !== 'não' && row.disponivel?.toLowerCase() !== 'nao',
        is_featured: row.destaque?.toLowerCase() === 'sim',
        prep_time_min: parseInt(String(row.tempo_preparo || '30')) || 30,
      });

      if (error) {
        errors.push(`Linha ${i + 2}: ${error.message}`);
      } else {
        success++;
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setResults({ success, errors });
    setImporting(false);
    if (success > 0) onImported();
  };

  const downloadTemplate = () => {
    const header = 'nome,descricao,preco,categoria,disponivel,destaque,tempo_preparo\n';
    const example = 'Pizza Margherita,Molho de tomate e mussarela,29.90,Pizzas,sim,sim,30\n';
    const blob = new Blob([header + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_produtos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar Produtos em Lote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie um arquivo CSV ou Excel com as colunas: <strong>nome</strong>, descricao, <strong>preco</strong>, categoria, disponivel, destaque, tempo_preparo
          </p>

          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" /> Baixar modelo CSV
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) parseFile(file);
              e.target.value = '';
            }}
          />

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {rows.length > 0
                ? `${rows.length} produtos encontrados. Clique para trocar arquivo.`
                : 'Clique ou arraste um arquivo CSV/Excel'}
            </p>
          </div>

          {rows.length > 0 && !results && (
            <>
              {importing && <Progress value={progress} className="h-2" />}
              <Button
                onClick={handleImport}
                disabled={importing}
                className="w-full gradient-primary text-white"
              >
                {importing ? `Importando... ${progress}%` : `Importar ${rows.length} produtos`}
              </Button>
            </>
          )}

          {results && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>{results.success} produtos importados com sucesso</span>
              </div>
              {results.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{results.errors.length} erros</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground bg-muted rounded-lg p-2 space-y-1">
                    {results.errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                </div>
              )}
              <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }} className="w-full">
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportDialog;
