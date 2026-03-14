import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type DatePreset, presetLabels } from '@/hooks/useDateRange';

interface DateRangeFilterProps {
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  customRange: { from?: Date; to?: Date };
  onCustomRangeChange: (range: { from?: Date; to?: Date }) => void;
}

const presetOptions: DatePreset[] = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth', 'max', 'custom'];

export default function DateRangeFilter({
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
}: DateRangeFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={preset} onValueChange={(v) => onPresetChange(v as DatePreset)}>
        <SelectTrigger className="w-[180px] h-9 bg-background/40 border-border/60 text-foreground">
          <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue className="text-foreground" />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((p) => (
            <SelectItem key={p} value={p}>
              {presetLabels[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'justify-start text-left font-normal h-9',
                  !customRange.from && 'text-muted-foreground'
                )}
              >
                {customRange.from
                  ? format(customRange.from, 'dd/MM/yyyy', { locale: ptBR })
                  : 'Data início'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customRange.from}
                onSelect={(date) =>
                  onCustomRangeChange({ ...customRange, from: date || undefined })
                }
                disabled={(date) => date > new Date()}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground text-sm">até</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'justify-start text-left font-normal h-9',
                  !customRange.to && 'text-muted-foreground'
                )}
              >
                {customRange.to
                  ? format(customRange.to, 'dd/MM/yyyy', { locale: ptBR })
                  : 'Data fim'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customRange.to}
                onSelect={(date) =>
                  onCustomRangeChange({ ...customRange, to: date || undefined })
                }
                disabled={(date) =>
                  date > new Date() || (customRange.from ? date < customRange.from : false)
                }
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
