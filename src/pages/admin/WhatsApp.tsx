import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

const WhatsApp = () => (
  <div className="space-y-6">
    <h1 className="text-2xl font-display font-bold">WhatsApp</h1>
    <Card className="glass">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">Em breve</p>
        <p className="text-sm text-muted-foreground">Integração com Uazapi para mensagens automáticas</p>
      </CardContent>
    </Card>
  </div>
);

export default WhatsApp;
