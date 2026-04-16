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
import PhoneInputField from "@/components/ui/phone-input";
import { ExternalLink } from "lucide-react";
import type { Guest } from "./EventManagement";

interface EditGuestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: Guest | null;
  eventId: string;
  onSuccess: () => void;
}

const normalizeWhatsApp = (value: string): string => {
  if (!value) return "";
  const digits = value.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length >= 10) return "+" + digits;
  return digits;
};

const EditGuestModal = ({ open, onOpenChange, guest, eventId, onSuccess }: EditGuestModalProps) => {
  const [name, setName] = useState("");
  const [maxAdults, setMaxAdults] = useState("1");
  const [maxChildren, setMaxChildren] = useState("0");
  const [status, setStatus] = useState<"pending" | "confirmed">("pending");
  const [confirmedAdults, setConfirmedAdults] = useState("0");
  const [confirmedChildren, setConfirmedChildren] = useState("0");
  const [observations, setObservations] = useState("");
  const [groupName, setGroupName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (guest && open) {
      setName(guest.name);
      setMaxAdults(String(guest.max_adults || 1));
      setMaxChildren(String(guest.max_children || 0));
      setStatus(guest.status === "confirmed" ? "confirmed" : "pending");
      setConfirmedAdults(String(guest.confirmed_adults || 0));
      setConfirmedChildren(String(guest.confirmed_children || 0));
      setObservations(guest.observations || "");
      setGroupName(guest.group_name || "");
      setWhatsapp(guest.whatsapp || "");
      setNameError("");
    }
  }, [guest, open]);

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

  const handleTestWhatsApp = () => {
    const normalized = normalizeWhatsApp(whatsapp);
    if (normalized) {
      const clean = normalized.replace(/[^0-9]/g, "");
      window.open(`https://wa.me/${clean}`, "_blank");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guest) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setNameError("Nome do convidado é obrigatório"); return; }

    setSaving(true);
    setNameError("");

    try {
      const { data: existingGuest, error: checkError } = await supabase
        .from("guests").select("id").eq("event_id", eventId).ilike("name", trimmedName).neq("id", guest.id).maybeSingle();
      if (checkError) throw checkError;
      if (existingGuest) { setNameError("Já existe um convidado com este nome neste evento"); setSaving(false); return; }

      const maxA = Math.max(0, parseInt(maxAdults) || 0);
      const maxC = Math.max(0, parseInt(maxChildren) || 0);
      const confA = status === "confirmed" ? Math.min(Math.max(0, parseInt(confirmedAdults) || 0), maxA) : 0;
      const confC = status === "confirmed" ? Math.min(Math.max(0, parseInt(confirmedChildren) || 0), maxC) : 0;

      const normalizedWa = normalizeWhatsApp(whatsapp);

      const { error } = await supabase.from("guests").update({
        name: trimmedName,
        max_adults: maxA,
        max_children: maxC,
        status,
        confirmed_adults: confA,
        confirmed_children: confC,
        observations: observations.trim() || null,
        group_name: groupName.trim() || null,
        whatsapp: normalizedWa || null,
      }).eq("id", guest.id);

      if (error) throw error;
      toast({ title: "Convidado atualizado", description: `${trimmedName} foi atualizado com sucesso.` });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!guest) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Editar Convidado</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome do Convidado <span className="text-destructive">*</span></Label>
            <Input id="edit-name" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} placeholder="Nome completo do convidado" className={nameError ? "border-destructive" : ""} />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-groupName">Grupo/Família</Label>
            <Input id="edit-groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Família Silva, Amigos do trabalho" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-whatsapp">WhatsApp</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <PhoneInputField
                  id="edit-whatsapp"
                  value={whatsapp}
                  onChange={setWhatsapp}
                  placeholder="+55 21 99999-9999"
                />
              </div>
              {whatsapp && (
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={handleTestWhatsApp} title="Testar link WhatsApp">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Número com código do país (DDI)</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-maxAdults">Limite de Adultos</Label>
              <Input id="edit-maxAdults" type="number" min="0" value={maxAdults} onChange={(e) => setMaxAdults(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-maxChildren">Limite de Crianças</Label>
              <Input id="edit-maxChildren" type="number" min="0" value={maxChildren} onChange={(e) => setMaxChildren(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={status} onValueChange={(value: "pending" | "confirmed") => setStatus(value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === "confirmed" && (
            <div className="p-4 rounded-lg bg-success-muted border border-success/20 space-y-4">
              <p className="text-sm font-medium text-success">Confirmação Manual</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-confirmedAdults">Adultos Confirmados</Label>
                  <Input id="edit-confirmedAdults" type="number" min="0" max={parseInt(maxAdults) || 0} value={confirmedAdults} onChange={(e) => setConfirmedAdults(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-confirmedChildren">Crianças Confirmadas</Label>
                  <Input id="edit-confirmedChildren" type="number" min="0" max={parseInt(maxChildren) || 0} value={confirmedChildren} onChange={(e) => setConfirmedChildren(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {guest.qr_code && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground">
                <strong>QR Code:</strong> {guest.qr_code.substring(0, 8)}...
                {guest.checkin_done && <span className="ml-2 text-success">(Check-in realizado)</span>}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-observations">Observações (opcional)</Label>
            <Textarea id="edit-observations" value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Anotações internas do organizador..." rows={3} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" className="btn-gold" disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditGuestModal;
