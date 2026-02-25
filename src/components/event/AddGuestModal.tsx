import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddGuestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSuccess: () => void;
}

const AddGuestModal = ({ open, onOpenChange, eventId, onSuccess }: AddGuestModalProps) => {
  const [name, setName] = useState("");
  const [maxAdults, setMaxAdults] = useState("1");
  const [maxChildren, setMaxChildren] = useState("0");
  const [status, setStatus] = useState<"pending" | "confirmed">("pending");
  const [confirmedAdults, setConfirmedAdults] = useState("0");
  const [confirmedChildren, setConfirmedChildren] = useState("0");
  const [observations, setObservations] = useState("");
  const [groupName, setGroupName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setName("");
      setMaxAdults("1");
      setMaxChildren("0");
      setStatus("pending");
      setConfirmedAdults("0");
      setConfirmedChildren("0");
      setObservations("");
      setGroupName("");
      setNameError("");
    }
  }, [open]);

  useEffect(() => {
    const maxA = parseInt(maxAdults) || 0;
    const confA = parseInt(confirmedAdults) || 0;
    if (confA > maxA) setConfirmedAdults(maxAdults);
  }, [maxAdults, confirmedAdults]);

  useEffect(() => {
    const maxC = parseInt(maxChildren) || 0;
    const confC = parseInt(confirmedChildren) || 0;
    if (confC > maxC) setConfirmedChildren(maxChildren);
  }, [maxChildren, confirmedChildren]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Nome do convidado é obrigatório");
      return;
    }

    setSaving(true);
    setNameError("");

    try {
      const { data: existingGuest, error: checkError } = await supabase
        .from("guests").select("id").eq("event_id", eventId).ilike("name", trimmedName).maybeSingle();
      if (checkError) throw checkError;
      if (existingGuest) {
        setNameError("Já existe um convidado com este nome neste evento");
        setSaving(false);
        return;
      }

      const maxA = Math.max(0, parseInt(maxAdults) || 0);
      const maxC = Math.max(0, parseInt(maxChildren) || 0);
      const confA = status === "confirmed" ? Math.min(Math.max(0, parseInt(confirmedAdults) || 0), maxA) : 0;
      const confC = status === "confirmed" ? Math.min(Math.max(0, parseInt(confirmedChildren) || 0), maxC) : 0;

      const { error } = await supabase.from("guests").insert({
        event_id: eventId,
        name: trimmedName,
        max_adults: maxA,
        max_children: maxC,
        status,
        confirmed_adults: confA,
        confirmed_children: confC,
        observations: observations.trim() || null,
        group_name: groupName.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Convidado adicionado",
        description: status === "confirmed"
          ? `${trimmedName} foi adicionado e confirmado. QR Code gerado.`
          : `${trimmedName} foi adicionado à lista.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Adicionar Convidado</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Convidado <span className="text-destructive">*</span></Label>
            <Input id="name" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} placeholder="Nome completo do convidado" className={nameError ? "border-destructive" : ""} />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            <p className="text-xs text-muted-foreground">Nome que será usado na busca da página pública e no QR Code</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupName">Grupo/Família</Label>
            <Input id="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Família Silva, Amigos do trabalho" />
            <p className="text-xs text-muted-foreground">Agrupar convidados por família ou grupo</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxAdults">Limite de Adultos</Label>
              <Input id="maxAdults" type="number" min="0" value={maxAdults} onChange={(e) => setMaxAdults(e.target.value)} />
              <p className="text-xs text-muted-foreground">Acompanhantes adultos permitidos</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxChildren">Limite de Crianças</Label>
              <Input id="maxChildren" type="number" min="0" value={maxChildren} onChange={(e) => setMaxChildren(e.target.value)} />
              <p className="text-xs text-muted-foreground">Crianças permitidas</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status Inicial</Label>
            <Select value={status} onValueChange={(value: "pending" | "confirmed") => setStatus(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {status === "confirmed" ? "QR Code será gerado automaticamente ao salvar" : "O convidado precisará confirmar presença na página pública"}
            </p>
          </div>

          {status === "confirmed" && (
            <div className="p-4 rounded-lg bg-success-muted border border-success/20 space-y-4">
              <p className="text-sm font-medium text-success">Confirmação Manual</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="confirmedAdults">Adultos Confirmados</Label>
                  <Input id="confirmedAdults" type="number" min="0" max={parseInt(maxAdults) || 0} value={confirmedAdults} onChange={(e) => setConfirmedAdults(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmedChildren">Crianças Confirmadas</Label>
                  <Input id="confirmedChildren" type="number" min="0" max={parseInt(maxChildren) || 0} value={confirmedChildren} onChange={(e) => setConfirmedChildren(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="observations">Observações (opcional)</Label>
            <Textarea id="observations" value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Anotações internas do organizador..." rows={3} />
            <p className="text-xs text-muted-foreground">Estas notas não são visíveis para o convidado</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" className="btn-gold" disabled={saving}>{saving ? "Salvando..." : "Salvar Convidado"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddGuestModal;
