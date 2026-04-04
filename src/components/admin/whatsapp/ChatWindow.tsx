import { useState, useEffect, useRef } from 'react';
import { Send, Image, ArrowLeft, Phone, Check, CheckCheck, Clock, Zap, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  direction: 'incoming' | 'outgoing';
  message_type: string;
  content: string | null;
  media_url: string | null;
  status: string;
  created_at: string;
}

interface CustomerInfo {
  name: string;
  phone: string;
  total_orders: number;
  total_spent: number;
  avg_ticket: number;
  last_order_at: string | null;
}

interface Props {
  contactPhone: string;
  contactName: string | null;
  tenantId: string;
  instanceName: string | null;
  instanceToken: string | null;
  onBack: () => void;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-gray-400" />;
  if (status === 'sent') return <Check className="h-3.5 w-3.5 text-gray-400" />;
  return <Clock className="h-3 w-3 text-gray-400" />;
}

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) return `(${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  return phone;
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

function getInitials(name: string | null, phone: string) {
  if (name) {
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

export default function ChatWindow({ contactPhone, contactName, tenantId, instanceName, instanceToken, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [quickReplies, setQuickReplies] = useState<{ name: string; message: string }[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load messages
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('whatsapp_messages')
        .select('id, direction, message_type, content, media_url, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('contact_phone', contactPhone)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((data || []) as Message[]);

      // Mark as read
      await supabase
        .from('whatsapp_messages')
        .update({ is_read: true })
        .eq('tenant_id', tenantId)
        .eq('contact_phone', contactPhone)
        .eq('direction', 'incoming')
        .eq('is_read', false);
    };
    load();
  }, [tenantId, contactPhone]);

  // Load customer info
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('customers')
        .select('name, phone, total_orders, total_spent, avg_ticket, last_order_at')
        .eq('tenant_id', tenantId)
        .eq('phone', contactPhone)
        .single();
      setCustomer(data as CustomerInfo | null);
    };
    load();
  }, [tenantId, contactPhone]);

  // Load quick replies (templates)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('whatsapp_templates')
        .select('name, message')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');
      setQuickReplies((data || []) as { name: string; message: string }[]);
    };
    load();
  }, [tenantId]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${contactPhone}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `contact_phone=eq.${contactPhone}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        if (newMsg.tenant_id === tenantId) {
          setMessages(prev => [...prev, newMsg]);
          // Auto mark as read
          if (newMsg.direction === 'incoming') {
            supabase.from('whatsapp_messages').update({ is_read: true }).eq('id', newMsg.id).then(() => {});
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `contact_phone=eq.${contactPhone}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, status: updated.status } : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, contactPhone]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !instanceName || !instanceToken) return;

    setSending(true);
    setNewMessage('');

    try {
      // Send via UaZapi
      const phone = contactPhone.replace(/\D/g, '');
      const res = await fetch(`https://api.uazapi.com/v2/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: instanceToken },
        body: JSON.stringify({ to: `${phone}@s.whatsapp.net`, text }),
      });

      const data = await res.json();

      // Save to database
      await supabase.from('whatsapp_messages').insert({
        tenant_id: tenantId,
        contact_phone: contactPhone,
        contact_name: contactName,
        direction: 'outgoing',
        message_type: 'text',
        content: text,
        status: res.ok ? 'sent' : 'failed',
        wa_message_id: data?.key?.id || null,
        is_read: true,
      });

      if (!res.ok) {
        toast({ title: 'Erro ao enviar', description: 'Verifique a conexão do WhatsApp', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const applyQuickReply = (msg: string) => {
    const name = contactName || 'cliente';
    const formatted = msg.replace(/\{\{nome\}\}/g, name.split(' ')[0]);
    setNewMessage(formatted);
    setShowQuickReplies(false);
    inputRef.current?.focus();
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    const date = formatDate(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      groupedMessages.push({ date, messages: [msg] });
    }
  });

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <button onClick={onBack} className="lg:hidden p-1 -ml-1 text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div
          className={`w-10 h-10 rounded-full ${getColor(contactPhone)} flex items-center justify-center text-white text-sm font-bold cursor-pointer`}
          onClick={() => setShowInfo(!showInfo)}
        >
          {getInitials(contactName, contactPhone)}
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowInfo(!showInfo)}>
          <p className="font-semibold text-gray-900 text-sm truncate">
            {contactName || formatPhone(contactPhone)}
          </p>
          <p className="text-xs text-gray-500">{formatPhone(contactPhone)}</p>
        </div>
        {customer && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg">
            <ShoppingBag className="h-3.5 w-3.5" />
            {customer.total_orders} pedidos · {fmt(customer.total_spent)}
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-4 py-3" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23e5e7eb\' fill-opacity=\'0.3\'%3E%3Ccircle cx=\'100\' cy=\'100\' r=\'2\'/%3E%3Ccircle cx=\'300\' cy=\'100\' r=\'2\'/%3E%3Ccircle cx=\'200\' cy=\'200\' r=\'2\'/%3E%3Ccircle cx=\'100\' cy=\'300\' r=\'2\'/%3E%3Ccircle cx=\'300\' cy=\'300\' r=\'2\'/%3E%3C/g%3E%3C/svg%3E")' }}>
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-3">
                  <span className="bg-white text-gray-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">
                    {group.date}
                  </span>
                </div>

                {group.messages.map((msg) => (
                  <div key={msg.id} className={`flex mb-1.5 ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${
                        msg.direction === 'outgoing'
                          ? 'bg-[#d9fdd3] rounded-tr-md'
                          : 'bg-white rounded-tl-md'
                      }`}
                    >
                      {msg.message_type === 'image' && msg.media_url && (
                        <img src={msg.media_url} alt="" className="rounded-lg max-w-full mb-1" style={{ maxHeight: 300 }} />
                      )}
                      {msg.message_type === 'audio' && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>🎵 Áudio</span>
                        </div>
                      )}
                      {msg.message_type === 'sticker' && (
                        <span className="text-2xl">🏷️</span>
                      )}
                      {msg.content && (
                        <p className="text-[13.5px] text-gray-900 whitespace-pre-wrap break-words leading-[1.35]">
                          {msg.content}
                        </p>
                      )}
                      <div className={`flex items-center gap-1 mt-0.5 ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                        {msg.direction === 'outgoing' && <StatusIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {showQuickReplies && quickReplies.length > 0 && (
            <div className="bg-white border-t border-gray-200 px-4 py-2 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase">Respostas Rápidas</span>
                <button onClick={() => setShowQuickReplies(false)} className="text-xs text-gray-400 hover:text-gray-600">Fechar</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {quickReplies.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => applyQuickReply(qr.message)}
                    className="text-left p-2 rounded-lg bg-gray-50 hover:bg-primary/5 border border-gray-100 hover:border-primary/20 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-700 truncate">{qr.name}</p>
                    <p className="text-[10px] text-gray-400 truncate mt-0.5">{qr.message.slice(0, 50)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="flex items-end gap-2">
              <button
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                className="p-2.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Respostas rápidas"
              >
                <Zap className="h-5 w-5" />
              </button>
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite uma mensagem..."
                  rows={1}
                  className="w-full px-4 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/10 resize-none max-h-32"
                  style={{ minHeight: 42 }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="p-2.5 rounded-full bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Customer Info Panel */}
        {showInfo && customer && (
          <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto flex-shrink-0 hidden md:block">
            <div className="text-center mb-4">
              <div className={`w-20 h-20 rounded-full ${getColor(contactPhone)} flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3`}>
                {getInitials(contactName, contactPhone)}
              </div>
              <h3 className="font-bold text-gray-900">{contactName || formatPhone(contactPhone)}</h3>
              <p className="text-sm text-gray-500">{formatPhone(contactPhone)}</p>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-gray-50 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Dados do Cliente</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-400">Pedidos</p>
                    <p className="text-sm font-bold text-gray-900">{customer.total_orders}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Total Gasto</p>
                    <p className="text-sm font-bold text-primary">{fmt(customer.total_spent)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Ticket Médio</p>
                    <p className="text-sm font-bold text-gray-900">{fmt(customer.avg_ticket)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Último Pedido</p>
                    <p className="text-sm font-bold text-gray-900">
                      {customer.last_order_at
                        ? new Date(customer.last_order_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
