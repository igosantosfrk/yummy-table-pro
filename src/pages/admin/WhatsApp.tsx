import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Wifi, WifiOff, RefreshCw, Loader2, QrCode, CheckCircle, Phone, Send, Settings, MessageCircle, Volume2, VolumeX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ConversationList, { Conversation } from '@/components/admin/whatsapp/ConversationList';
import ChatWindow from '@/components/admin/whatsapp/ChatWindow';

interface WaInstance {
  id: string;
  instance_name: string | null;
  instance_token: string | null;
  phone_number: string | null;
  is_connected: boolean | null;
  auto_send_confirmation: boolean | null;
  auto_send_preparing: boolean | null;
  auto_send_delivery: boolean | null;
  auto_send_completed: boolean | null;
}


import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SetupForm = ({ tenantId, onComplete }: { tenantId: string; onComplete: () => void }) => {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !token.trim()) {
      toast({ title: 'Preencha nome e token da instância', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('whatsapp_instances').insert({
      tenant_id: tenantId,
      instance_name: name.trim(),
      instance_token: token.trim(),
      is_connected: false,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Instância configurada!' });
    onComplete();
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="space-y-2">
        <Label>Nome da Instância (UaZapi)</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="ex: minha-instancia" />
      </div>
      <div className="space-y-2">
        <Label>Token da Instância</Label>
        <Input value={token} onChange={e => setToken(e.target.value)} placeholder="Token de acesso UaZapi" type="password" />
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full gradient-primary text-white">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
        Salvar e Configurar
      </Button>
    </div>
  );
};

const WhatsApp = () => {
  const { tenantId } = useAuth();
  const [instance, setInstance] = useState<WaInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<string>('chat');

  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [pinnedPhones, setPinnedPhones] = useState<Set<string>>(new Set());
  const [labelMap, setLabelMap] = useState<Record<string, string>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);

  const fetchInstance = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();
    setInstance(data as WaInstance | null);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchInstance(); }, [fetchInstance]);

  // Load conversations
  const fetchConversations = useCallback(async () => {
    if (!tenantId) return;
    // Get latest message per contact, ordered by most recent
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('contact_phone, contact_name, content, direction, created_at, is_read')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (!data) return;

    // Group by contact phone
    const convMap = new Map<string, Conversation>();
    for (const msg of data) {
      if (!convMap.has(msg.contact_phone)) {
        convMap.set(msg.contact_phone, {
          contact_phone: msg.contact_phone,
          contact_name: msg.contact_name,
          last_message: msg.content,
          last_direction: msg.direction,
          last_message_at: msg.created_at,
          unread_count: 0,
        });
      }
      // Count unread
      if (msg.direction === 'incoming' && !msg.is_read) {
        const conv = convMap.get(msg.contact_phone)!;
        conv.unread_count++;
      }
      // Update name if available
      if (msg.contact_name && !convMap.get(msg.contact_phone)!.contact_name) {
        convMap.get(msg.contact_phone)!.contact_name = msg.contact_name;
      }
    }

    // Sort by last message time
    const sorted = Array.from(convMap.values()).sort(
      (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );
    setConversations(sorted.map(cv => ({ ...cv, is_pinned: pinnedPhones.has(cv.contact_phone), label: labelMap[cv.contact_phone] || null })));
  }, [tenantId]);

  useEffect(() => {
    if (tab === 'chat') fetchConversations();
  }, [tab, fetchConversations]);

  // Realtime for new messages (refresh conversation list)
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel('wa-conversations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, fetchConversations]);

  // Sound for new messages
  const playMessageSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 600; osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }, [soundEnabled]);

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase.channel('wa-new-msg-sound')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload: any) => {
        if (payload.new?.direction === 'incoming' && payload.new?.tenant_id === tenantId) playMessageSound();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, playMessageSound]);

  const togglePin = (phone: string) => {
    setPinnedPhones(prev => { const n = new Set(prev); if (n.has(phone)) n.delete(phone); else n.add(phone); return n; });
  };

  const setLabel = (phone: string, label: string | null) => {
    setLabelMap(prev => { const n = { ...prev }; if (label) n[phone] = label; else delete n[phone]; return n; });
  };

  const startNewChat = () => {
    const phone = newChatPhone.replace(/\D/g, '');
    if (phone.length < 10) { toast({ title: 'Numero invalido', variant: 'destructive' }); return; }
    const formatted = phone.startsWith('55') ? phone : '55' + phone;
    setSelectedPhone(formatted); setSelectedName(null); setShowNewChat(false); setNewChatPhone('');
  };

  const selectConversation = (phone: string) => {
    setSelectedPhone(phone);
    const conv = conversations.find(c => c.contact_phone === phone);
    setSelectedName(conv?.contact_name || null);
  };

  const getQrCode = async () => {
    if (!instance?.instance_name || !instance?.instance_token) return;
    setQrLoading(true);
    setQrCode(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('whatsapp-send', {
        body: { action: 'getQrCode', tenant_id: tenantId },
      });
      if (fnErr) throw fnErr;
      if (data.qrcode || data.base64 || data.qr) {
        setQrCode(data.qrcode || data.base64 || data.qr);
      } else if (data.connected || data.status === 'CONNECTED') {
        toast({ title: 'WhatsApp já está conectado!' });
        await supabase.from('whatsapp_instances').update({ is_connected: true }).eq('id', instance?.id);
        fetchInstance();
      } else {
        toast({ title: 'Não foi possível gerar QR Code', description: JSON.stringify(data), variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao buscar QR Code', description: err.message, variant: 'destructive' });
    }
    setQrLoading(false);
  };

  const checkStatus = async () => {
    if (!instance?.instance_name || !instance?.instance_token) return;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('whatsapp-send', {
        body: { action: 'status', tenant_id: tenantId },
      });
      if (fnErr) throw fnErr;
      const connected = data.connected === true || data.status === 'CONNECTED' || data.state === 'open';
      await supabase.from('whatsapp_instances').update({ is_connected: connected }).eq('id', instance?.id);
      toast({ title: connected ? 'WhatsApp conectado!' : 'WhatsApp desconectado' });
      fetchInstance();
    } catch (err: any) {
      toast({ title: 'Erro ao verificar status', description: err.message, variant: 'destructive' });
    }
  };

  const toggleAutoSend = async (field: string, value: boolean) => {
    if (!instance) return;
    setSaving(true);
    await supabase.from('whatsapp_instances').update({ [field]: value }).eq('id', instance?.id);
    setInstance(prev => prev ? { ...prev, [field]: value } : null);
    setSaving(false);
    toast({ title: 'Configuração salva!' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = instance?.is_connected === true;
  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/30 border border-border/20">
            <TabsTrigger value="chat" className="gap-1.5 data-[state=active]:bg-white">
              <MessageCircle className="h-4 w-4" />
              Conversas
              {totalUnread > 0 && (
                <Badge className="bg-primary text-white text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center">
                  {totalUnread}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 data-[state=active]:bg-white">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* Sound + Connection */}
          <div className="flex items-center gap-2">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 rounded-lg hover:bg-gray-100" title={soundEnabled ? 'Desativar som' : 'Ativar som'}>
              {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-gray-400" />}
            </button>
            {isConnected ? (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 gap-1">
                <Wifi className="h-3 w-3" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500 gap-1">
                <WifiOff className="h-3 w-3" /> Desconectado
              </Badge>
            )}
          </div>
        </div>

        {/* Chat Tab */}
        <TabsContent value="chat" className="mt-4">
          <Card className="glass overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
            <div className="flex h-full">
              {/* Conversation List - hidden on mobile when chat is open */}
              <div className={`w-full lg:w-96 flex-shrink-0 ${selectedPhone ? 'hidden lg:block' : 'block'}`}>
                <ConversationList
                  conversations={conversations}
                  selectedPhone={selectedPhone}
                  onSelect={selectConversation}
                  onNewConversation={() => setShowNewChat(true)}
                  onTogglePin={togglePin}
                  onSetLabel={setLabel}
                />
                {showNewChat && (
                  <div className="absolute inset-0 bg-black/30 z-30 flex items-center justify-center" onClick={() => setShowNewChat(false)}>
                    <div className="bg-white rounded-xl p-5 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
                      <h3 className="font-bold text-gray-900 mb-3">Nova Conversa</h3>
                      <Input value={newChatPhone} onChange={e => setNewChatPhone(e.target.value)} placeholder="(11) 99999-9999" className="mb-3" onKeyDown={e => e.key === 'Enter' && startNewChat()} autoFocus />
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setShowNewChat(false)}>Cancelar</Button>
                        <Button className="flex-1 gradient-primary text-white" onClick={startNewChat}>Iniciar</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Window or Empty State */}
              <div className={`flex-1 ${selectedPhone ? 'block' : 'hidden lg:block'}`}>
                {selectedPhone ? (
                  <ChatWindow
                    contactPhone={selectedPhone}
                    contactName={selectedName}
                    tenantId={tenantId!}
                    tenantSlug="meu-restaurante"
                    instanceName={instance?.instance_name}
                    instanceToken={instance?.instance_token}
                    onBack={() => setSelectedPhone(null)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full bg-[#f0f2f5] text-gray-400">
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                      <MessageSquare className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-500">Menu Maestro Chat</p>
                    <p className="text-sm text-gray-400 mt-1">Selecione uma conversa para começar</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-4 space-y-6">
          {/* Setup or Connection Card */}
          {!instance && (
            <Card className="glass border-dashed border-amber-200 bg-amber-50/50">
              <CardContent className="py-8">
                <div className="text-center mb-6">
                  <MessageSquare className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                  <p className="text-lg font-semibold text-gray-900">Configure o WhatsApp</p>
                  <p className="text-sm text-gray-500 mt-1">Insira os dados da sua instância UaZapi para ativar o chat</p>
                </div>
                <SetupForm tenantId={tenantId!} onComplete={fetchInstance} />
              </CardContent>
            </Card>
          )}
          {instance && (<Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <MessageSquare className="h-5 w-5 text-green-500" /> Conexão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <Wifi className="h-6 w-6 text-green-600" />
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <WifiOff className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-lg">{isConnected ? 'Conectado' : 'Desconectado'}</p>
                    {instance?.phone_number && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {instance?.phone_number}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={checkStatus}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Verificar
                  </Button>
                  {!isConnected && (
                    <Button size="sm" onClick={getQrCode} disabled={qrLoading} className="gradient-primary text-white">
                      {qrLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <QrCode className="h-4 w-4 mr-1" />}
                      Gerar QR Code
                    </Button>
                  )}
                </div>
              </div>

              {qrCode && !isConnected && (
                <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-xl border border-gray-200">
                  <p className="text-sm font-medium text-gray-700">Escaneie o QR Code com seu WhatsApp</p>
                  <div className="p-4 bg-white rounded-xl shadow-lg">
                    <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} alt="QR Code" className="w-64 h-64" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">1. Abra o WhatsApp no celular</p>
                    <p className="text-xs text-gray-500">2. Toque em Configurações → Aparelhos conectados</p>
                    <p className="text-xs text-gray-500">3. Toque em Conectar aparelho e escaneie o código</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={checkStatus}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Já escaneei
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>)}

          {instance && (<Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Send className="h-5 w-5 text-primary" /> Mensagens Automáticas
              </CardTitle>
              <CardDescription>
                Envie mensagens automáticas no WhatsApp quando o status do pedido mudar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { field: 'auto_send_confirmation', label: 'Confirmação de Pedido', desc: 'Enviada quando o pedido é recebido', value: instance?.auto_send_confirmation },
                { field: 'auto_send_preparing', label: 'Em Preparo', desc: 'Enviada quando o pedido começa a ser preparado', value: instance?.auto_send_preparing },
                { field: 'auto_send_delivery', label: 'Saiu para Entrega', desc: 'Enviada quando o pedido sai para entrega', value: instance?.auto_send_delivery },
                { field: 'auto_send_completed', label: 'Pedido Entregue', desc: 'Enviada quando o pedido é finalizado', value: instance?.auto_send_completed },
              ].map(item => (
                <div key={item.field} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={item.value ?? false}
                    onCheckedChange={(v) => toggleAutoSend(item.field, v)}
                    disabled={saving || !isConnected}
                  />
                </div>
              ))}
              {!isConnected && (
                <p className="text-xs text-amber-600 text-center">Conecte o WhatsApp para ativar as mensagens automáticas</p>
              )}
            </CardContent>
          </Card>)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsApp;
