import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Save, Loader2, Eye, EyeOff, Share2 } from "lucide-react";

interface ShareHostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  currentPassword: string | null;
  currentAllowEdit: boolean;
}

const ShareHostModal = ({ open, onOpenChange, eventId, eventName, currentPassword, currentAllowEdit }: ShareHostModalProps) => {
  const [password, setPassword] = useState(currentPassword || "");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allowEdit, setAllowEdit] = useState(currentAllowEdit);
  const [savingEdit, setSavingEdit] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setPassword(currentPassword || "");
      setAllowEdit(currentAllowEdit);
    }
  }, [open, currentPassword, currentAllowEdit]);

  const hostUrl = `${window.location.origin}/evento/${eventId}/anfitriao`;

  const handleSave = async () => {
    const trimmed = password.trim();
    if (trimmed && (trimmed.length < 4 || trimmed.length > 6)) {
      toast({ title: "Senha inválida", description: "A senha deve ter entre 4 e 6 caracteres.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ host_password: trimmed || null } as any)
        .eq("id", eventId);

      if (error) throw error;
      toast({ title: "Senha salva!", description: trimmed ? "A senha do anfitrião foi atualizada." : "A senha do anfitrião foi removida." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAllowEditChange = async (checked: boolean) => {
    setAllowEdit(checked);
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ allow_host_edit: checked } as any)
        .eq("id", eventId);

      if (error) throw error;
      toast({ title: checked ? "Edição habilitada" : "Edição desabilitada", description: checked ? "O anfitrião poderá adicionar e excluir convidados." : "O anfitrião terá acesso somente leitura." });
    } catch (error: any) {
      setAllowEdit(!checked);
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyAll = () => {
    const trimmed = password.trim();
    if (!trimmed) {
      toast({ title: "Defina uma senha primeiro", description: "Salve uma senha antes de compartilhar.", variant: "destructive" });
      return;
    }
    const text = `Acompanhe as confirmações do evento "${eventName}":\n\nLink: ${hostUrl}\nSenha: ${trimmed}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Link e senha copiados para a área de transferência." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhar com Anfitrião
          </DialogTitle>
          <DialogDescription>
            Compartilhe o link e a senha para que o anfitrião acompanhe as confirmações em tempo real.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Senha do Anfitrião (4-6 dígitos)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ex: 1234"
                  maxLength={6}
                  className="input-elegant pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={handleSave} disabled={saving} className="btn-gold">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Permitir edição</Label>
              <p className="text-xs text-muted-foreground">Permitir que o anfitrião adicione ou exclua convidados</p>
            </div>
            <Switch
              checked={allowEdit}
              onCheckedChange={handleAllowEditChange}
              disabled={savingEdit}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Link do Anfitrião</Label>
            <p className="text-xs text-muted-foreground font-mono break-all bg-muted p-3 rounded-lg">
              {hostUrl}
            </p>
          </div>

          <Button
            onClick={handleCopyAll}
            variant="outline"
            className="w-full rounded-full"
            disabled={!password.trim()}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Link e Senha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareHostModal;
