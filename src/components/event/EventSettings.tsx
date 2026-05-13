import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  Mail,
  QrCode,
  List,
  Hash,
  Copy,
  Link,
  Webhook,
  ChevronDown,
  Trash2,
  Save,
  Loader2,
  ImageIcon,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import CoverImageUpload from "@/components/dashboard/CoverImageUpload";

interface EventSettingsProps {
  eventId: string;
  userId: string;
  onBack: () => void;
}

interface EventData {
  id: string;
  name: string;
  event_date: string;
  short_message: string | null;
  cover_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  host_email: string | null;
  email_notifications: boolean | null;
  checkin_mode: string | null;
  checkin_code: string | null;
  checkin_password: string | null;
  host_password: string | null;
  webhook_url: string | null;
  confirmation_active: boolean | null;
  confirmation_deadline: string | null;
  auto_block: boolean | null;
  qr_children: boolean;
}

const EventSettings = ({ eventId, userId, onBack }: EventSettingsProps) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [shortMessage, setShortMessage] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#D4AF37");
  const [secondaryColor, setSecondaryColor] = useState("#FDF8F3");
  const [hostEmail, setHostEmail] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [checkinMode, setCheckinMode] = useState("manual");
  const [checkinCode, setCheckinCode] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [checkinPassword, setCheckinPassword] = useState("");
  const [hostPassword, setHostPassword] = useState("");
  const [confirmationActive, setConfirmationActive] = useState(true);
  const [autoBlock, setAutoBlock] = useState(false);
  const [qrChildren, setQrChildren] = useState(false);
  const [confirmationDeadline, setConfirmationDeadline] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchEvent = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      setEvent(data);
      setName(data.name);
      setEventDate(data.event_date);
      setShortMessage(data.short_message || "");
      setCoverImageUrl(data.cover_image_url);
      setPrimaryColor(data.primary_color || "#D4AF37");
      setSecondaryColor(data.secondary_color || "#FDF8F3");
      setHostEmail(data.host_email || "");
      setEmailNotifications(data.email_notifications || false);
      setCheckinMode(data.checkin_mode || "manual");
      setCheckinCode(data.checkin_code || "");
      setWebhookUrl(data.webhook_url || "");
      setCheckinPassword((data as any).checkin_password || "");
      setHostPassword((data as any).host_password || "");
      setConfirmationActive(data.confirmation_active !== false);
      setAutoBlock(data.auto_block || false);
      setQrChildren(data.qr_children || false);
      setConfirmationDeadline(data.confirmation_deadline ? data.confirmation_deadline.substring(0, 16) : "");
    } catch (error: any) {
      toast({
        title: "Erro ao carregar evento",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [eventId, userId, navigate, toast]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "O nome do evento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (!eventDate) {
      toast({
        title: "Data obrigatória",
        description: "A data do evento é obrigatória",
        variant: "destructive",
      });
      return;
    }

    // Validate webhook URL if provided
    if (webhookUrl.trim()) {
      const urlValidation = validateWebhookUrl(webhookUrl);
      if (!urlValidation.valid) {
        toast({
          title: "URL do Webhook inválida",
          description: urlValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("events")
        .update({
          name: name.trim(),
          event_date: eventDate,
          short_message: shortMessage.trim() || null,
          cover_image_url: coverImageUrl,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          host_email: hostEmail.trim() || null,
          email_notifications: emailNotifications,
          checkin_mode: checkinMode,
          checkin_password: checkinPassword.trim() || null,
          host_password: hostPassword.trim() || null,
          webhook_url: webhookUrl.trim() || null,
          confirmation_active: confirmationActive,
          auto_block: autoBlock,
          qr_children: qrChildren,
          confirmation_deadline: autoBlock && confirmationDeadline ? confirmationDeadline : null,
        })
        .eq("id", eventId)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Alterações salvas!",
        description: "As configurações do evento foram atualizadas.",
      });
      
      // Return to guests list after saving
      onBack();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    try {
      // First delete all guests
      await supabase.from("guests").delete().eq("event_id", eventId);
      
      // Then delete the event
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Evento excluído",
        description: "O evento e todos os convidados foram removidos.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência.`,
    });
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      toast({
        title: "URL necessária",
        description: "Salve a URL do webhook primeiro",
        variant: "destructive",
      });
      return;
    }

    // Validate URL format and security before testing
    const urlValidation = validateWebhookUrl(webhookUrl);
    if (!urlValidation.valid) {
      toast({
        title: "URL inválida",
        description: urlValidation.error,
        variant: "destructive",
      });
      return;
    }

    setTestingWebhook(true);

    try {
      // Use secure edge function to send webhook
      const { data, error } = await supabase.functions.invoke('send-webhook', {
        body: {
          webhook_url: webhookUrl,
          payload: {
            type: "test",
            event_id: eventId,
            event_name: name,
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Webhook testado!",
        description: "A requisição foi enviada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro no webhook",
        description: error.message || "Falha ao enviar webhook",
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  // Validate webhook URL to prevent SSRF attacks
  const validateWebhookUrl = (url: string): { valid: boolean; error?: string } => {
    if (!url.trim()) return { valid: false, error: "URL é obrigatória" };
    
    try {
      const parsed = new URL(url);

      // Block localhost and private IPs
      const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0'];
      if (blockedHostnames.some(h => parsed.hostname.toLowerCase() === h)) {
        return { valid: false, error: "URLs locais não são permitidas" };
      }

      // Block private IP ranges
      const blockedPatterns = [
        /^127\.\d+\.\d+\.\d+$/,
        /^10\.\d+\.\d+\.\d+$/,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
        /^192\.168\.\d+\.\d+$/,
        /^169\.254\.\d+\.\d+$/,
      ];

      if (blockedPatterns.some(p => p.test(parsed.hostname))) {
        return { valid: false, error: "IPs privados não são permitidos" };
      }

      // Require HTTPS
      if (parsed.protocol !== 'https:') {
        return { valid: false, error: "Apenas URLs HTTPS são permitidas" };
      }

      return { valid: true };
    } catch {
      return { valid: false, error: "Formato de URL inválido" };
    }
  };

  const checkinUrl = `${window.location.origin}/checkin/${checkinCode}`;

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Sticky header with Save */}
      <div className="sticky top-0 z-30 -mx-8 px-8 py-4 bg-background/95 backdrop-blur border-b border-border mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2 hover:bg-accent rounded-lg transition-colors shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-display font-bold text-foreground truncate">
                {event.name}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Atualize as informações do evento</p>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="btn-gold rounded-full px-6 shrink-0"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            <span className="hidden sm:inline">Salvar Alterações</span>
            <span className="sm:hidden">Salvar</span>
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Info Card */}
        <div className="card-elegant p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Nome do Evento *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do evento"
              className="input-elegant"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium">
              Data do Evento *
            </Label>
            <Input
              id="date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="input-elegant"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm font-medium">
              Mensagem Curta
            </Label>
            <Textarea
              id="message"
              value={shortMessage}
              onChange={(e) => setShortMessage(e.target.value)}
              placeholder="Confirme sua presença ✨"
              rows={3}
              className="input-elegant resize-none"
            />
          </div>
        </div>

        {/* Confirmation Control Card */}
        <div className="card-elegant p-6 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium text-foreground">Controle de Confirmações</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie a abertura e fechamento das confirmações de presença
          </p>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-sm">Confirmações ativas</p>
              <p className="text-xs text-muted-foreground">
                {confirmationActive
                  ? "Convidados podem confirmar presença"
                  : "Confirmações desativadas manualmente"}
              </p>
            </div>
            <Switch
              checked={confirmationActive}
              onCheckedChange={setConfirmationActive}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-sm">Bloqueio automático por data</p>
              <p className="text-xs text-muted-foreground">
                {autoBlock
                  ? "Confirmações serão bloqueadas após a data limite"
                  : "Sem prazo para confirmação"}
              </p>
            </div>
            <Switch
              checked={autoBlock}
              onCheckedChange={setAutoBlock}
            />
          </div>

          {autoBlock && (
            <div className="space-y-2">
              <Label htmlFor="confirmationDeadline" className="text-sm font-medium">
                Data limite para confirmação
              </Label>
              <Input
                id="confirmationDeadline"
                type="datetime-local"
                value={confirmationDeadline}
                onChange={(e) => setConfirmationDeadline(e.target.value)}
                className="input-elegant"
              />
            </div>
          )}
        </div>

        {/* Check-in Mode Card */}
        <div className="card-elegant p-6 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <QrCode className="h-4 w-4" />
            <span className="font-medium text-foreground">Modo de Check-in</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Configurar como será feito o check-in dos convidados no dia do evento
          </p>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-sm">Ativar confirmação por QR Code (Scanner)</p>
              <p className="text-xs text-muted-foreground">
                {checkinMode === "scanner"
                  ? "Os pedidos farão check-in via leitura de QR Code"
                  : "O check-in será feito pela lista manual"}
              </p>
            </div>
            <Switch
              checked={checkinMode === "scanner"}
              onCheckedChange={(checked) =>
                setCheckinMode(checked ? "scanner" : "manual")
              }
            />
          </div>

          <div className="flex items-center gap-2 py-2 px-3 bg-muted rounded-lg">
            {checkinMode === "scanner" ? (
              <>
                <QrCode className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Modo: Leitor de QR Code</span>
              </>
            ) : (
              <>
                <List className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Modo: Lista Manual</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between py-2 border-t border-border pt-4">
            <div>
              <p className="font-medium text-sm">Gerar QR Code para crianças</p>
              <p className="text-xs text-muted-foreground">
                {qrChildren
                  ? "QR Codes serão gerados para adultos e crianças"
                  : "QR Codes serão gerados apenas para adultos"}
              </p>
            </div>
            <Switch
              checked={qrChildren}
              onCheckedChange={setQrChildren}
            />
          </div>
        </div>

        {/* Cover Image Card */}
        <div className="card-elegant p-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Foto de Capa</Label>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Tamanho ideal: 1920 × 1080px (proporção 16:9) — a imagem aparecerá como banner horizontal
            </p>
          </div>

          {coverImageUrl ? (
            <div className="relative rounded-xl overflow-hidden aspect-video">
              <img
                src={coverImageUrl}
                alt="Capa do evento"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setCoverImageUrl(null)}
                className="absolute top-3 right-3 p-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="absolute bottom-0 left-0 right-0 text-center py-2 bg-background/80 text-xs text-muted-foreground">
                Preview: área visível no cabeçalho do evento
              </p>
            </div>
          ) : (
            <CoverImageUpload
              userId={userId}
              coverUrl={null}
              onUpload={(url) => setCoverImageUrl(url)}
              onRemove={() => {}}
            />
          )}
        </div>

        {/* Colors Card */}
        <div className="card-elegant p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cor Primária</Label>
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
                  className="input-elegant font-mono uppercase"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cor Secundária</Label>
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
                  className="input-elegant font-mono uppercase"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Email Notifications Card */}
        <div className="card-elegant p-6 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="font-medium text-foreground">Notificado por e-mail</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Receba um e-mail sempre que um convidado confirmar a presença
          </p>

          <div className="space-y-2">
            <Label htmlFor="hostEmail" className="text-sm font-medium">
              E-mail do Anfitrião
            </Label>
            <Input
              id="hostEmail"
              type="email"
              value={hostEmail}
              onChange={(e) => setHostEmail(e.target.value)}
              placeholder="seu@email.com"
              className="input-elegant"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-sm">Receber confirmações por e-mail</p>
              <p className="text-xs text-muted-foreground">
                {emailNotifications
                  ? "Você receberá um e-mail com cada nova confirmação"
                  : "Notícias desativadas"}
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          {emailNotifications && !webhookUrl && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs text-warning">
                Configure um webhook (Make/Zapier) na seção abaixo para que os e-mails sejam enviados.
              </p>
            </div>
          )}
        </div>

        {/* Public Event Page Card */}
        <div className="card-elegant p-6 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link className="h-4 w-4" />
            <span className="font-medium text-foreground">Página do Evento</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Link público onde os convidados podem confirmar presença
          </p>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="rounded-full"
             asChild
            >
             <a
               href={`/confirmar/${eventId}`}
               target="_blank"
               rel="noopener noreferrer"
             >
               <Link className="h-4 w-4 mr-2" />
               Ver Página
             </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(`${window.location.origin}/confirmar/${eventId}`, "Link da página")}
              className="rounded-full"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar link
            </Button>
          </div>

          <p className="text-xs text-muted-foreground font-mono">
            {`${window.location.origin}/confirmar/${eventId}`}
          </p>
        </div>

        {/* Check-in Code Card */}
        <div className="card-elegant p-6 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hash className="h-4 w-4" />
            <span className="font-medium text-foreground">Código de Check-in</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Utilize este código para acessar a área de check-in sem login
          </p>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold tracking-widest">
              {checkinCode || "------"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(checkinCode, "Código")}
              className="rounded-full"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(checkinUrl, "Link")}
              className="rounded-full"
            >
              <Link className="h-4 w-4 mr-1" />
              Copiar link
            </Button>
          </div>

          <p className="text-xs text-muted-foreground font-mono">
            {checkinUrl}
          </p>

          <div className="space-y-2 pt-3 border-t border-border">
            <Label htmlFor="checkinPassword" className="text-sm font-medium">
              Senha do Check-in
            </Label>
            <Input
              id="checkinPassword"
              type="password"
              value={checkinPassword}
              onChange={(e) => setCheckinPassword(e.target.value)}
              placeholder="Defina uma senha para acesso sem login"
              className="input-elegant"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Esta senha será exigida ao acessar o link de check-in sem login.
            </p>
          </div>
        </div>

        {/* Host Password Card */}
        <div className="card-elegant p-6 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hash className="h-4 w-4" />
            <span className="font-medium text-foreground">Visão do Anfitrião</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Defina uma senha para o anfitrião acompanhar as confirmações (somente leitura)
          </p>

          <div className="space-y-2">
            <Label htmlFor="hostPassword" className="text-sm font-medium">
              Senha do Anfitrião (4-6 dígitos)
            </Label>
            <Input
              id="hostPassword"
              type="password"
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
              placeholder="Ex: 1234"
              className="input-elegant"
              maxLength={6}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              O anfitrião usará esta senha para acessar o link: <span className="font-mono">{window.location.origin}/evento/{eventId}/anfitriao</span>
            </p>
          </div>
        </div>

        {/* Webhook Integration Card */}
        <Collapsible open={webhookOpen} onOpenChange={setWebhookOpen}>
          <div className="card-elegant overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full p-6 flex items-center justify-between hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Notificações automáticas (Webhook)</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      webhookUrl
                        ? "bg-success/20 text-success"
                        : "bg-warning/20 text-warning"
                    }`}
                  >
                    {webhookUrl ? "Configurado" : "Não configurado"}
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    webhookOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  Configure uma URL do webhook do Make para receber notificações quando solicitado confirmarem presença.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="webhook" className="text-sm font-medium">
                    URL para Webhook
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="webhook"
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hook.us1.make.com/..."
                      className="input-elegant font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl, "URL")}
                      disabled={!webhookUrl}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestWebhook}
                  disabled={!webhookUrl || testingWebhook}
                  className="rounded-full"
                >
                  {testingWebhook ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Testar Webhook
                </Button>

                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Últimos Registros
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Nenhum registro ainda
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Danger Zone */}
        <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 space-y-4 mt-8">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Zona de Perigo</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Ações irreversíveis. Todos os convidados, confirmações e dados associados serão permanentemente removidos.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Evento
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Todos os convidados e dados do evento serão permanentemente removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteEvent}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default EventSettings;
