import { useState } from 'react';
import { Search, MessageSquare, Plus, Pin, Tag, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

export interface Conversation {
  contact_phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_direction: string;
  last_message_at: string;
  unread_count: number;
  label?: string | null;
  is_pinned?: boolean;
}

interface Props {
  conversations: Conversation[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  onNewConversation: () => void;
  onTogglePin: (phone: string) => void;
  onSetLabel: (phone: string, label: string | null) => void;
}

const labels: { key: string; label: string; color: string; icon: React.ElementType }[] = [
  { key: 'waiting', label: 'Aguardando', color: 'bg-amber-500', icon: Clock },
  { key: 'resolved', label: 'Resolvido', color: 'bg-emerald-500', icon: CheckCircle },
  { key: 'urgent', label: 'Urgente', color: 'bg-red-500', icon: AlertTriangle },
];

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) return `(${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  if (clean.length === 12) return `(${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  return phone;
}

function getInitials(name: string | null, phone: string) {
  if (name) {
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

const avatarColors = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-indigo-500',
];

function getColor(phone: string) {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

export default function ConversationList({ conversations, selectedPhone, onSelect, onNewConversation, onTogglePin, onSetLabel }: Props) {
  const [search, setSearch] = useState('');
  const [labelMenu, setLabelMenu] = useState<string | null>(null);

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase();
    return (c.contact_name?.toLowerCase().includes(q) || c.contact_phone.includes(q));
  });

  // Sort: pinned first, then by last message time
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
  });

  const labelInfo = (key: string | null | undefined) => labels.find(l => l.key === key);

  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Conversas</h2>
        <button
          onClick={onNewConversation}
          className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          title="Nova conversa"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4">
            <MessageSquare className="h-10 w-10 mb-2" />
            <p className="text-sm">Nenhuma conversa</p>
          </div>
        ) : (
          sorted.map(conv => {
            const li = labelInfo(conv.label);
            return (
              <div key={conv.contact_phone} className="relative group">
                <button
                  onClick={() => onSelect(conv.contact_phone)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                    selectedPhone === conv.contact_phone ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full ${getColor(conv.contact_phone)} flex items-center justify-center text-white text-sm font-bold`}>
                      {getInitials(conv.contact_name, conv.contact_phone)}
                    </div>
                    {conv.is_pinned && (
                      <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <Pin className="h-2.5 w-2.5 text-gray-500" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {conv.contact_name || formatPhone(conv.contact_phone)}
                        </p>
                        {li && (
                          <span className={`${li.color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0`}>
                            {li.label}
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] flex-shrink-0 ml-2 ${conv.unread_count > 0 ? 'text-primary font-semibold' : 'text-gray-400'}`}>
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-gray-500 truncate pr-2">
                        {conv.last_direction === 'outgoing' && <span className="text-gray-400">Você: </span>}
                        {conv.last_message || '📎 Mídia'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="bg-primary text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 flex-shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Quick actions on hover */}
                <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onTogglePin(conv.contact_phone); }}
                    className={`p-1 rounded-md transition-colors ${conv.is_pinned ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                    title={conv.is_pinned ? 'Desafixar' : 'Fixar'}
                  >
                    <Pin className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setLabelMenu(labelMenu === conv.contact_phone ? null : conv.contact_phone); }}
                    className="p-1 rounded-md bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Etiqueta"
                  >
                    <Tag className="h-3 w-3" />
                  </button>
                </div>

                {/* Label dropdown */}
                {labelMenu === conv.contact_phone && (
                  <div className="absolute right-2 top-10 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
                    {labels.map(l => (
                      <button
                        key={l.key}
                        onClick={() => { onSetLabel(conv.contact_phone, conv.label === l.key ? null : l.key); setLabelMenu(null); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 ${conv.label === l.key ? 'font-semibold' : ''}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${l.color}`} />
                        {l.label}
                        {conv.label === l.key && <span className="ml-auto text-primary">✓</span>}
                      </button>
                    ))}
                    {conv.label && (
                      <button
                        onClick={() => { onSetLabel(conv.contact_phone, null); setLabelMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-t border-gray-100 mt-1"
                      >
                        Remover etiqueta
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
