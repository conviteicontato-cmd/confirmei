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
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  event_limit: number | null;
  event_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  systemLimit: number;
  onLimitUpdated: () => void;
}

const AdjustLimitModal = ({ open, onOpenChange, user, systemLimit, onLimitUpdated }: Props) => {
  const [isUnlimited, setIsUnlimited] = useState(user?.event_limit === -1);
  const [useSystemDefault, setUseSystemDefault] = useState(user?.event_limit === null);
  const [limitValue, setLimitValue] = useState(
    user?.event_limit && user.event_limit > 0 ? user.event_limit.toString() : systemLimit.toString()
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let newLimit: number | null;
      
      if (isUnlimited) {
        newLimit = -1;
      } else if (useSystemDefault) {
        newLimit = null;
      } else {
        newLimit = parseInt(limitValue, 10);
        if (isNaN(newLimit) || newLimit < 0) {
          toast({
            title: "Erro",
            description: "Informe um limite válido",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "update_user_limit",
          userId: user.user_id,
          newLimit,
          reason: reason || null,
        },
      });

      if (error) throw error;

      toast({ title: "Limite atualizado com sucesso" });
      onLimitUpdated();
      onOpenChange(false);
      setReason("");
    } catch (err) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o limite",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveLimit = () => {
    if (isUnlimited) return "Ilimitado";
    if (useSystemDefault) return `${systemLimit} (padrão do sistema)`;
    return limitValue;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar Limite de Eventos</DialogTitle>
          <DialogDescription>
            Defina o limite de eventos para <strong>{user?.full_name}</strong>.
            Atualmente: {user?.event_count || 0} eventos criados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Unlimited toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="unlimited">Eventos ilimitados</Label>
            <Switch
              id="unlimited"
              checked={isUnlimited}
              onCheckedChange={(checked) => {
                setIsUnlimited(checked);
                if (checked) setUseSystemDefault(false);
              }}
            />
          </div>

          {!isUnlimited && (
            <>
              {/* Use system default toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="systemDefault">Usar padrão do sistema</Label>
                  <p className="text-xs text-muted-foreground">
                    Limite atual do sistema: {systemLimit} eventos
                  </p>
                </div>
                <Switch
                  id="systemDefault"
                  checked={useSystemDefault}
                  onCheckedChange={setUseSystemDefault}
                />
              </div>

              {/* Custom limit input */}
              {!useSystemDefault && (
                <div>
                  <Label htmlFor="limit">Limite personalizado</Label>
                  <Input
                    id="limit"
                    type="number"
                    min="0"
                    value={limitValue}
                    onChange={(e) => setLimitValue(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </>
          )}

          {/* Preview */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Novo limite: </span>
              <span className="font-medium">{getEffectiveLimit()}</span>
            </p>
          </div>

          {/* Reason */}
          <div>
            <Label htmlFor="reason">Motivo da alteração (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Pacote premium, solicitação do cliente..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdjustLimitModal;
