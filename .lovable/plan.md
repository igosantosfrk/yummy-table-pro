

# 🍕 Cardápio Digital Premium - SaaS Multi-Tenant

## Visão Geral
Sistema SaaS completo para restaurantes com cardápio digital premium, gestão de pedidos, delivery, pagamentos e integrações — tudo com arquitetura multi-tenant usando Supabase.

---

## FASE 1 — Fundação Multi-Tenant e Autenticação

### Banco de Dados (Supabase)
- Criar estrutura multi-tenant com tabelas: `tenants`, `user_roles`, `profiles`
- Enum de roles: `super_admin`, `tenant_admin`, `tenant_user`
- RLS em todas as tabelas baseado em `tenant_id`
- Função `has_role()` security definer para evitar recursão
- Trigger para criar profile automaticamente no signup

### Autenticação
- Página de login/registro com email
- Proteção de rotas por role
- Contexto global de autenticação e tenant

### Super Admin Panel
- Dashboard com estatísticas globais
- CRUD de licenças (tenants) com status ativo/suspenso
- Gestão de planos e assinaturas
- Monitoramento de pedidos e receita por tenant

---

## FASE 2 — Painel Administrativo do Restaurante

### Dashboard do Restaurante
- KPIs: pedidos do dia, faturamento, ticket médio, pedidos por status
- Gráficos de vendas e produtos mais vendidos
- Forma de pagamento mais utilizada

### Gestão de Categorias
- CRUD de categorias com nome, ícone e ordenação
- Drag-and-drop para reordenar

### Gestão de Produtos
- CRUD completo com: nome, descrição, preço, categoria, foto, vídeo, tempo de preparo, disponibilidade
- Upload de imagens e vídeos via Supabase Storage
- Sistema de adicionais/extras com preços
- Combos e produtos relacionados
- Toggle de disponibilidade rápido

### Configurações do Restaurante
- Logo, banner, cores, nome, endereço, horário de funcionamento
- Slug personalizado para o link público

---

## FASE 3 — Cardápio Digital Público (Mobile-First Premium)

### Design Premium
- Layout mobile-first com animações suaves
- Banner do restaurante com logo
- Navegação por categorias (scroll horizontal com âncoras)
- Cards de produtos com imagens grandes e vídeos autoplay
- Estilo visual inspirado em Apple UI / iFood

### Rota Pública
- Acessível via `plataforma.com/{slug-do-restaurante}`
- Sem necessidade de login para o cliente

### Carrinho
- Drawer lateral com itens, quantidades, adicionais
- Observações por item
- Cálculo automático de subtotal e taxa de entrega

### Checkout
- Formulário: nome, telefone, endereço de entrega
- Seleção de forma de pagamento (PIX, cartão, dinheiro)
- Resumo do pedido com confirmação

---

## FASE 4 — Gestão de Pedidos e Delivery

### Painel de Pedidos
- Kanban visual com status: Novo → Em Preparo → Saiu para Entrega → Finalizado / Cancelado
- Detalhes do pedido: cliente, itens, valor, pagamento, endereço, horário
- Notificação sonora para novos pedidos
- Atualização em tempo real via Supabase Realtime

### Sistema de Delivery
- Cadastro de entregadores (nome, telefone, status)
- Configuração de taxa de entrega por bairro
- Raio de entrega e tempo médio
- Atribuição de entregador ao pedido

---

## FASE 5 — Pagamentos e Stripe

### Assinaturas SaaS (Stripe)
- Integração Stripe para cobrar planos dos restaurantes
- Checkout de assinatura, webhooks de confirmação
- Painel financeiro no Super Admin

### Pagamentos dos Pedidos
- PIX automático via Stripe (QR Code dinâmico)
- Pagamento com cartão online via Stripe
- Webhook para confirmação automática de pagamento
- Atualização automática do status do pedido após pagamento

---

## FASE 6 — Integrações Externas

### WhatsApp (Uazapi)
- Edge function para comunicação com API da Uazapi
- Cada tenant com sua própria instância/configuração
- Mensagens automáticas: confirmação, preparo, saiu para entrega, finalizado
- Restaurante recebe pedido completo via WhatsApp

### Impressora de Cozinha
- Edge function para formatar pedido em layout térmico
- Integração via sistema de impressão em rede (o restaurante precisa ter um agente local)
- Formato: nº pedido, itens, observações, endereço, horário

### iFood (Fase futura)
- Sincronização de pedidos do iFood para o painel unificado
- Atualização de status bidirecional
- *Nota: requer acesso à API oficial do iFood com credenciais de parceiro*

---

## Estrutura de Páginas

| Página | Descrição |
|--------|-----------|
| `/login` | Login e registro |
| `/super-admin` | Painel do dono da plataforma |
| `/admin` | Dashboard do restaurante |
| `/admin/products` | Gestão de produtos |
| `/admin/categories` | Gestão de categorias |
| `/admin/orders` | Gestão de pedidos (Kanban) |
| `/admin/delivery` | Entregadores e configurações |
| `/admin/settings` | Configurações do restaurante |
| `/admin/payments` | Financeiro |
| `/admin/whatsapp` | Configuração WhatsApp |
| `/:slug` | Cardápio público do restaurante |
| `/:slug/cart` | Carrinho |
| `/:slug/checkout` | Checkout |
| `/:slug/order/:id` | Acompanhamento do pedido |

---

## Notas Técnicas
- **Stack**: React + Vite + Tailwind + TypeScript (Lovable) com Supabase externo
- **Multi-tenant**: Todas as tabelas com `tenant_id` e RLS policies
- **Storage**: Supabase Storage para imagens e vídeos de produtos
- **Realtime**: Supabase Realtime para atualização de pedidos
- **Edge Functions**: Para integrações (WhatsApp, pagamentos, impressora)

