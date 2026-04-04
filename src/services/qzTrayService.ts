import qz from 'qz-tray';

export interface PrinterConfig {
  printerName: string;
  paperWidth: '58mm' | '80mm';
  autoPrint: boolean;
  copies: number;
  soundEnabled: boolean;
}

const DEFAULT_CONFIG: PrinterConfig = {
  printerName: '',
  paperWidth: '80mm',
  autoPrint: true,
  copies: 1,
  soundEnabled: true,
};

const STORAGE_KEY = 'menu-maestro-printer-config';

class QzTrayService {
  private connected = false;
  private connecting = false;

  getConfig(): PrinterConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  saveConfig(config: Partial<PrinterConfig>): PrinterConfig {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }

  isConnected(): boolean {
    try {
      return this.connected && qz.websocket.isActive();
    } catch {
      return false;
    }
  }

  async connect(): Promise<boolean> {
    if (this.isConnected()) return true;
    if (this.connecting) return false;

    this.connecting = true;
    try {
      if (!qz.websocket.isActive()) {
        // Allow unsigned connections for local use
        qz.security.setCertificatePromise(() => Promise.resolve(''));
        qz.security.setSignatureAlgorithm('SHA512');
        qz.security.setSignaturePromise(() => () => Promise.resolve(''));

        await qz.websocket.connect();
      }
      this.connected = true;
      return true;
    } catch (err: any) {
      console.warn('QZ Tray nao conectado:', err?.message || err);
      this.connected = false;
      return false;
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected()) {
      try {
        await qz.websocket.disconnect();
      } catch {
        // ignore
      }
      this.connected = false;
    }
  }

  async listPrinters(): Promise<string[]> {
    if (!await this.connect()) return [];
    try {
      const printers = await qz.printers.find();
      return Array.isArray(printers) ? printers : [printers];
    } catch (err) {
      console.error('Erro ao listar impressoras:', err);
      return [];
    }
  }

  async printRaw(data: string[], printerName?: string): Promise<boolean> {
    const config = this.getConfig();
    const printer = printerName || config.printerName;

    if (!printer) {
      console.error('Nenhuma impressora configurada');
      return false;
    }

    if (!await this.connect()) {
      console.error('QZ Tray nao esta conectado');
      return false;
    }

    try {
      const qzConfig = qz.configs.create(printer, {
        copies: config.copies,
      });

      await qz.print(qzConfig, data);
      return true;
    } catch (err) {
      console.error('Erro ao imprimir:', err);
      return false;
    }
  }
}

export const qzTrayService = new QzTrayService();
export default qzTrayService;
