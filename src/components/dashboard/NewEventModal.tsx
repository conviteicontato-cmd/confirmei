import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import CoverImageUpload from "./CoverImageUpload";
import {
  ArrowLeft,
  Mail,
  QrCode,
  List,
  Loader2,
  Save,
  AlertTriangle,
} from "lucide-react";

interface NewEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onEventCreated: () => void;
}

const NewEventModal = ({
  open,
  onOpenChange,
  userId,
  onEventCreated,
}: NewEventModalProps) => {
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [shortMessage, setShortMessage] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#D4AF37");
  const [secondaryColor, setSecondaryColor] = useState("#FDF8F3");
  const [hostEmail, setHostEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [checkinMode, setCheckinMode] = useState<"manual" | "qr">("manual");
  const [loading, setLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(true);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const { toast } = useToast();
  const { settings } = useSystemSettings();

  // Check if user can create event when modal opens
  useEffect(() => {
    if (open && userId) {
      checkEventLimit();
    }
  }, [open, userId]);

  const checkEventLimit = async () => {
    setCheckingLimit(true);
    try {
      const { data, error } = await supabase.rpc("can_user_create_event", {
        _user_id: userId,
      });

      if (error) throw error;
      setCanCreate(data === true);
    } catch (err) {
      console.error("Error checking event limit:", err);
      // Default to allowing creation if check fails
      setCanCreate(true);
    } finally {
      setCheckingLimit(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canCreate) {
      toast({
        title: "Sem eventos disponíveis",
        description: "Você não possui eventos disponíveis no momento. Entre em contato com o administrador para liberar novos eventos.",
        variant: "destructive",
      });
      return;
    }

    if (!name.trim() || !eventDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e a data do evento.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("events").insert({
        user_id: userId,
        name: name.trim(),
        event_date: eventDate,
        short_message: shortMessage.trim() || null,
        cover_image_url: coverImageUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        host_email: hostEmail.trim() || null,
        email_notifications: emailNotifications,
        checkin_mode: checkinMode,
      });

      if (error) throw error;

      // Reset form
      setName("");
      setEventDate("");
      setShortMessage("");
      setCoverImageUrl(null);
      setPrimaryColor("#D4AF37");
      setSecondaryColor("#FDF8F3");
      setHostEmail("");
      setEmailNotifications(false);
      setCheckinMode("manual");

      onEventCreated();
    } catch (error: any) {
      toast({
        title: "Erro ao criar evento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 hover:bg-muted rounded-md transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <DialogTitle className="font-display text-xl">
                Novo Evento
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Configure seu novo evento
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Limit Warning */}
          {checkingLimit ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !canCreate ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Você não possui eventos disponíveis no momento</p>
                <p className="text-sm text-muted-foreground">
                  Entre em contato com o administrador para liberar novos eventos.
                </p>
              </div>
            </div>
          ) : null}

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome do Evento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: 15 Anos da Maria"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-elegant"
                disabled={!canCreate}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eventDate">
                Data do Evento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="input-elegant"
                disabled={!canCreate}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shortMessage">Mensagem Curta</Label>
              <Textarea
                id="shortMessage"
                placeholder="Confirme sua presença"
                value={shortMessage}
                onChange={(e) => setShortMessage(e.target.value)}
                className="input-elegant resize-none"
                rows={2}
                disabled={!canCreate}
              />
            </div>
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Foto de Capa</Label>
            <p className="text-xs text-muted-foreground">
              Tamanho ideal: 1920 × 1080px (proporção 16:9)
            </p>
            <CoverImageUpload
              userId={userId}
              coverUrl={coverImageUrl}
              onUpload={(url) => setCoverImageUrl(url)}
              onRemove={() => setCoverImageUrl(null)}
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor Primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="input-elegant font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor Secundária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="input-elegant font-mono"
                />
              </div>
            </div>
          </div>

          {/* Email Notification */}
          <div className="card-elegant p-4 space-y-4 bg-accent/30">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Notificação por e-mail</p>
                <p className="text-sm text-muted-foreground">
                  Receba um e-mail sempre que um convidado confirme a presença
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="hostEmail">E-mail do Anfitrião</Label>
                <Input
                  id="hostEmail"
                  type="email"
                  placeholder="seu@email.com"
                  value={hostEmail}
                  onChange={(e) => setHostEmail(e.target.value)}
                  className="input-elegant"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    Receber confirmações por e-mail
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {emailNotifications
                      ? "Você receberá um e-mail a cada nova confirmação"
                      : "Notificações desativadas"}
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </div>
          </div>

          {/* Check-in Mode */}
          <div className="card-elegant p-4 space-y-4 bg-accent/30">
            <div className="flex items-start gap-3">
              <QrCode className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Modo de Check-in</p>
                <p className="text-sm text-muted-foreground">
                  Configurar como será feito o check-in dos convidados no dia do
                  evento
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Ativar confirmação por QR Code (Scanner)
                </p>
                <p className="text-xs text-muted-foreground">
                  {checkinMode === "qr"
                    ? "Os convidados farão check-in via leitura de QR Code"
                    : "O check-in será feito pela lista manual"}
                </p>
              </div>
              <Switch
                checked={checkinMode === "qr"}
                onCheckedChange={(checked) =>
                  setCheckinMode(checked ? "qr" : "manual")
                }
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              {checkinMode === "qr" ? (
                <>
                  <QrCode className="h-4 w-4" />
                  <span>Modo: Scanner QR</span>
                </>
              ) : (
                <>
                  <List className="h-4 w-4" />
                  <span>Modo: Lista Manual</span>
                </>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="btn-gold rounded-full px-8"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Criar Evento
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewEventModal;
