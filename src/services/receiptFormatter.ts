import type { PrinterConfig } from './qzTrayService';

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string | null;
  addons?: any;
}

interface OrderData {
  order_number: number;
  customer_name: string;
  customer_phone: string;
  delivery_address?: string | null;
  delivery_neighborhood?: string | null;
  delivery_city?: string | null;
  delivery_notes?: string | null;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  coupon_code?: string | null;
  total: number;
  notes?: string | null;
  created_at: string;
  items: OrderItem[];
  restaurant_name?: string;
}

const ESC = '\x1B';
const GS = '\x1D';
const LF = '\n';

const CMD = {
  INIT: ESC + '@',
  BOLD_ON: ESC + 'E\x01',
  BOLD_OFF: ESC + 'E\x00',
  ALIGN_CENTER: ESC + 'a\x01',
  ALIGN_LEFT: ESC + 'a\x00',
  ALIGN_RIGHT: ESC + 'a\x02',
  DOUBLE_HEIGHT: ESC + '!\x10',
  DOUBLE_WIDTH: ESC + '!\x20',
  DOUBLE_SIZE: ESC + '!\x30',
  NORMAL_SIZE: ESC + '!\x00',
  CUT: GS + 'V\x00',
  PARTIAL_CUT: GS + 'V\x01',
  FEED_3: ESC + 'd\x03',
  FEED_5: ESC + 'd\x05',
};

function formatCurrency(value: number): string {
  return 'R$ ' + value.toFixed(2).replace('.', ',');
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str;
}

function paymentLabel(method: string): string {
  const labels: Record<string, string> = {
    pix: 'PIX',
    credit_card: 'Cartao Credito',
    debit_card: 'Cartao Debito',
    cash: 'Dinheiro',
    online: 'Online',
  };
  return labels[method] || method;
}

export function formatReceipt(order: OrderData, config: PrinterConfig): string[] {
  const is80 = config.paperWidth === '80mm';
  const cols = is80 ? 48 : 32;
  const LINE = '-'.repeat(cols);
  const DLINE = '='.repeat(cols);

  const lines: string[] = [];
  const add = (text: string) => lines.push(text);

  // Initialize
  add(CMD.INIT);

  // Header
  add(CMD.ALIGN_CENTER);
  add(CMD.DOUBLE_SIZE);
  add(CMD.BOLD_ON);
  add('PEDIDO #' + order.order_number);
  add(CMD.NORMAL_SIZE);
  add(CMD.BOLD_OFF);
  add(LF);

  if (order.restaurant_name) {
    add(CMD.BOLD_ON);
    add(order.restaurant_name);
    add(CMD.BOLD_OFF);
    add(LF);
  }

  add(formatDate(order.created_at));
  add(LF);
  add(DLINE);

  // Customer
  add(CMD.ALIGN_LEFT);
  add(CMD.BOLD_ON);
  add('CLIENTE');
  add(CMD.BOLD_OFF);
  add(order.customer_name);
  add('Tel: ' + order.customer_phone);

  if (order.delivery_address) {
    add(LINE);
    add(CMD.BOLD_ON);
    add('ENTREGA');
    add(CMD.BOLD_OFF);
    add(order.delivery_address);
    if (order.delivery_neighborhood) add(order.delivery_neighborhood);
    if (order.delivery_city) add(order.delivery_city);
    if (order.delivery_notes) {
      add('Obs: ' + order.delivery_notes);
    }
  }

  // Items
  add(DLINE);
  add(CMD.BOLD_ON);
  if (is80) {
    add(padRight('ITEM', 26) + padLeft('QTD', 5) + padLeft('VALOR', 9) + padLeft('TOTAL', 8));
  } else {
    add(padRight('ITEM', 16) + padLeft('QT', 4) + padLeft('TOTAL', 12));
  }
  add(CMD.BOLD_OFF);
  add(LINE);

  for (const item of order.items) {
    if (is80) {
      const name = padRight(item.product_name.substring(0, 26), 26);
      const qty = padLeft(String(item.quantity), 5);
      const price = padLeft(formatCurrency(item.unit_price), 9);
      const total = padLeft(formatCurrency(item.total), 8);
      add(name + qty + price + total);
    } else {
      add(CMD.BOLD_ON);
      add(item.quantity + 'x ' + item.product_name);
      add(CMD.BOLD_OFF);
      add(CMD.ALIGN_RIGHT);
      add(formatCurrency(item.total));
      add(CMD.ALIGN_LEFT);
    }

    if (item.addons && Array.isArray(item.addons)) {
      for (const addon of item.addons) {
        const addonName = typeof addon === 'string' ? addon : addon?.name || '';
        if (addonName) add('  + ' + addonName);
      }
    }

    if (item.notes) {
      add('  Obs: ' + item.notes);
    }
  }

  // Totals
  add(DLINE);
  add(CMD.ALIGN_RIGHT);

  const labelWidth = is80 ? 36 : 20;
  const valWidth = is80 ? 12 : 12;

  add(padRight('Subtotal:', labelWidth) + padLeft(formatCurrency(order.subtotal), valWidth));

  if (order.delivery_fee > 0) {
    add(padRight('Taxa entrega:', labelWidth) + padLeft(formatCurrency(order.delivery_fee), valWidth));
  }

  if (order.discount > 0) {
    add(padRight('Desconto:', labelWidth) + padLeft('-' + formatCurrency(order.discount), valWidth));
  }

  if (order.coupon_code) {
    add(padRight('Cupom: ' + order.coupon_code, labelWidth) + padLeft('', valWidth));
  }

  add(LINE);
  add(CMD.BOLD_ON);
  add(CMD.DOUBLE_HEIGHT);
  add(padRight('TOTAL:', labelWidth) + padLeft(formatCurrency(order.total), valWidth));
  add(CMD.NORMAL_SIZE);
  add(CMD.BOLD_OFF);

  // Payment
  add(LINE);
  add(CMD.ALIGN_LEFT);
  add(CMD.BOLD_ON);
  add('Pagamento: ' + paymentLabel(order.payment_method));
  add(CMD.BOLD_OFF);

  // Notes
  if (order.notes) {
    add(LINE);
    add(CMD.BOLD_ON);
    add('OBSERVACOES:');
    add(CMD.BOLD_OFF);
    add(order.notes);
  }

  // Footer
  add(LF);
  add(CMD.ALIGN_CENTER);
  add(LINE);
  add('Menu Maestro - Sistema de Delivery');
  add(CMD.FEED_5);
  add(CMD.PARTIAL_CUT);

  return lines;
}
