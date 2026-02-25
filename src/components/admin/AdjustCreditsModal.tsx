import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, RotateCcw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  events_contracted: number;
  events_used: number;
  available_events: number;
  is_super_admin?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onCreditsUpdated: () => void;
}

const AdjustCreditsModal = ({ open, onOpenChange, user, onCreditsUpdated }: Props) => {
  const [activeTab, setActiveTab] = useState<"add" | "reset">("add");
  const [addAmount, setAddAmount] = useState("1");
  const [resetAmount, setResetAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAddCredits = async () => {
    if (!user) return;
    
    const amount = parseInt(addAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Erro",
        description: "Informe uma quantidade válida",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const newTotal = (user.events_contracted || 0) + amount;
      
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "update_user_credits",
          userId: user.user_id,
          eventsContracted: newTotal,
          reason: reason || `Adicionado +${amount} eventos`,
        },
      });

      if (error) throw error;

      toast({ title: `+${amount} eventos adicionados com sucesso` });
      onCreditsUpdated();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar créditos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetCredits = async () => {
    if (!user) return;
    
    const newContracted = parseInt(resetAmount, 10);
    if (isNaN(newContracted) || newContracted < 0) {
      toast({
        title: "Erro",
        description: "Informe uma quantidade válida",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "reset_user_credits",
          userId: user.user_id,
          newContracted,
          reason: reason || "Reset de créditos - novo ciclo",
        },
      });

      if (error) throw error;

      toast({ title: "Créditos resetados com sucesso" });
      onCreditsUpdated();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      toast({
        title: "Erro",
        description: "Não foi possível resetar créditos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setAddAmount("1");
    setResetAmount("");
    setReason("");
    setActiveTab("add");
  };

  if (!user) return null;

  // Super Admin check
  if (user.is_super_admin) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Créditos de Eventos</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">∞</span>
            </div>
            <p className="font-medium text-lg">{user.full_name}</p>
            <p className="text-muted-foreground">Este usuário é Super Admin</p>
            <p className="text-sm text-muted-foreground mt-2">
              Super Admins têm eventos ilimitados e não consomem créditos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const availableEvents = Math.max(0, (user.events_contracted || 0) - (user.events_used || 0));
  const previewAfterAdd = availableEvents + (parseInt(addAmount, 10) || 0);
  const previewAfterReset = parseInt(resetAmount, 10) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar Créditos de Eventos</DialogTitle>
          <DialogDescription>
            Ajuste os eventos disponíveis para <strong>{user.full_name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Current Status */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{user.events_contracted || 0}</div>
              <div className="text-xs text-muted-foreground">Contratados</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{user.events_used || 0}</div>
              <div className="text-xs text-muted-foreground">Utilizados</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${availableEvents === 0 ? "text-destructive" : "text-green-600"}`}>
                {availableEvents}
              </div>
              <div className="text-xs text-muted-foreground">Disponíveis</div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "add" | "reset")}>
          <TabsList className="w-full">
            <TabsTrigger value="add" className="flex-1">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </TabsTrigger>
            <TabsTrigger value="reset" className="flex-1">
              <RotateCcw className="h-4 w-4 mr-1" />
              Resetar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-4 mt-4">
            <div>
              <Label htmlFor="addAmount">Quantidade de eventos a adicionar</Label>
              <Input
                id="addAmount"
                type="number"
                min="1"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Preview */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Após adicionar: </span>
                <span className="font-medium text-green-600">{previewAfterAdd} eventos disponíveis</span>
              </p>
            </div>

            <div>
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Ex: Pacote premium, renovação..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <Button onClick={handleAddCredits} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar +{addAmount || 0} Eventos
            </Button>
          </TabsContent>

          <TabsContent value="reset" className="space-y-4 mt-4">
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-sm text-muted-foreground">
                O reset irá zerar os eventos utilizados e definir um novo total de eventos contratados.
                Use para iniciar um novo ciclo ou plano.
              </p>
            </div>

            <div>
              <Label htmlFor="resetAmount">Novo total de eventos contratados</Label>
              <Input
                id="resetAmount"
                type="number"
                min="0"
                placeholder={String(user.events_contracted || 0)}
                value={resetAmount}
                onChange={(e) => setResetAmount(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Preview */}
            {resetAmount && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Após reset: </span>
                  <span className="font-medium text-blue-600">
                    {previewAfterReset} contratados • 0 utilizados • {previewAfterReset} disponíveis
                  </span>
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="resetReason">Motivo (opcional)</Label>
              <Textarea
                id="resetReason"
                placeholder="Ex: Novo ciclo, renovação de plano..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            <Button 
              onClick={handleResetCredits} 
              disabled={loading || !resetAmount} 
              variant="outline"
              className="w-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Resetar Créditos
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdjustCreditsModal;
