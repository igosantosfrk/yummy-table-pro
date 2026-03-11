import { useState, useMemo } from 'react';
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export type DatePreset = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

export const presetLabels: Record<DatePreset, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  last7: 'Últimos 7 dias',
  thisMonth: 'Este mês',
  lastMonth: 'Mês passado',
  custom: 'Personalizado',
};

function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case 'last7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfDay(now) };
    case 'lastMonth': {
      const lm = subMonths(now, 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    }
    default:
      return { from: startOfDay(now), to: endOfDay(now) };
  }
}

export function useDateRange(defaultPreset: DatePreset = 'today') {
  const [preset, setPreset] = useState<DatePreset>(defaultPreset);
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const dateRange = useMemo<DateRange>(() => {
    if (preset === 'custom' && customRange.from && customRange.to) {
      return { from: startOfDay(customRange.from), to: endOfDay(customRange.to) };
    }
    if (preset === 'custom') {
      return getPresetRange('today');
    }
    return getPresetRange(preset);
  }, [preset, customRange.from, customRange.to]);

  const setPresetValue = (p: DatePreset) => {
    setPreset(p);
    if (p !== 'custom') {
      setCustomRange({});
    }
  };

  return {
    preset,
    setPreset: setPresetValue,
    dateRange,
    customRange,
    setCustomRange,
  };
}
