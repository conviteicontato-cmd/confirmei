import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Pencil, Trash2, RotateCcw, Send, Clock, QrCode, CheckCircle, MessageSquare, X, MoreVertical, Users, Baby, FolderOpen, Phone, Copy, ExternalLink, Mail, CheckCheck } from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import type { Guest } from "./EventManagement";

interface WhatsAppTemplate {
  id: string;
  template_type: string;
  title: string;
  message_body: string;
}

interface MessageLog {
  id: string;
  guest_id: string;
  template_type: string;
  action_type: string;
  sent_at: string;
}

interface GuestTableProps {
  guests: Guest[];
  eventId: string;
  eventName?: string;
  eventDate?: string;
  webhookUrl?: string | null;
  onRefresh: () => void;
  onEdit?: (guest: Guest) => void;
}

interface GroupStats {
  name: string;
  total: number;
  confirmed: number;
  pending: number;
  expectedPeople: number;
  checkedIn: number;
}

const TEMPLATE_LABELS: Record<string, string> = {
  confirmation: "Confirmação",
  reminder: "Lembrete",
  extra: "Extra",
};

const GuestTable = ({ guests, eventId, eventName, eventDate, webhookUrl, onRefresh, onEdit }: GuestTableProps) => {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [messageFilter, setMessageFilter] = useState("__all__");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null);
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  const { toast } = useToast();

  // Fetch WhatsApp templates
  useEffect(() => {
    supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("event_id", eventId)
      .then(({ data }) => {
        if (data) setWaTemplates(data as WhatsAppTemplate[]);
      });
  }, [eventId]);

  // Fetch message logs
  const fetchLogs = useCallback(() => {
    supabase
      .from("whatsapp_message_logs")
      .select("id, guest_id, template_type, action_type, sent_at")
      .eq("event_id", eventId)
      .order("sent_at", { ascending: false })
      .then(({ data }) => {
        if (data) setMessageLogs(data);
      });
  }, [eventId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getGuestLogs = useCallback((guestId: string) => {
    return messageLogs.filter(l => l.guest_id === guestId);
  }, [messageLogs]);

  const getGuestLogsByType = useCallback((guestId: string) => {
    const logs = getGuestLogs(guestId);
    const map: Record<string, MessageLog> = {};
    for (const log of logs) {
      if (!map[log.template_type]) map[log.template_type] = log;
    }
    return map;
  }, [getGuestLogs]);

  const buildMessage = (guest: Guest, template: WhatsAppTemplate): string => {
    let msg = template.message_body;
    msg = msg.replace(/\{\{nome_convidado\}\}/g, guest.name);
    msg = msg.replace(/\{\{nome_evento\}\}/g, eventName || "");
    msg = msg.replace(/\{\{data_evento\}\}/g, eventDate ? new Date(eventDate + "T12:00:00").toLocaleDateString("pt-BR") : "");
    msg = msg.replace(/\{\{link_confirmacao\}\}/g, `${window.location.origin}/event/${eventId}`);
    return msg;
  };

  const logMessageAction = async (guest: Guest, template: WhatsAppTemplate, actionType: "open_whatsapp" | "copy_message") => {
    const { data: { session } } = await supabase.auth.getSession();
    const msg = buildMessage(guest, template);
    await supabase.from("whatsapp_message_logs").insert({
      event_id: eventId,
      guest_id: guest.id,
      template_type: template.template_type,
      message_content: msg,
      action_type: actionType,
      sent_by: session?.user?.id || null,
    });
    fetchLogs();
  };

  const handleOpenWhatsApp = async (guest: Guest, template: WhatsAppTemplate) => {
    if (!guest.whatsapp) {
      toast({ title: "Sem WhatsApp", description: `${guest.name} não possui número de WhatsApp cadastrado.`, variant: "destructive" });
      return;
    }
    if (!template.message_body.trim()) {
      toast({ title: "Template vazio", description: `O template "${template.title}" está sem conteúdo. Edite-o na aba Mensagens.`, variant: "destructive" });
      return;
    }
    const phone = guest.whatsapp.replace(/[^0-9]/g, "");
    const msg = buildMessage(guest, template);
    const link = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(link, "_blank");
    await logMessageAction(guest, template, "open_whatsapp");
    toast({ title: "WhatsApp aberto", description: `Mensagem de ${TEMPLATE_LABELS[template.template_type] || template.title} para ${guest.name}.` });
  };

  const handleCopyMessage = async (guest: Guest, template: WhatsAppTemplate) => {
    if (!guest.whatsapp) {
      toast({ title: "Sem WhatsApp", description: `${guest.name} não possui número de WhatsApp cadastrado.`, variant: "destructive" });
      return;
    }
    if (!template.message_body.trim()) {
      toast({ title: "Template vazio", description: `O template "${template.title}" está sem conteúdo.`, variant: "destructive" });
      return;
    }
    const msg = buildMessage(guest, template);
    try {
      await navigator.clipboard.writeText(msg);
      await logMessageAction(guest, template, "copy_message");
      toast({ title: "Mensagem copiada", description: `Texto de ${TEMPLATE_LABELS[template.template_type] || template.title} copiado para ${guest.name}.` });
    } catch {
      toast({ title: "Erro ao copiar", description: "Não foi possível copiar a mensagem.", variant: "destructive" });
    }
  };

  // Compute unique groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    guests.forEach(g => { if (g.group_name) set.add(g.group_name); });
    return Array.from(set).sort();
  }, [guests]);

  // Compute group stats
  const groupStats = useMemo((): GroupStats[] => {
    if (groups.length === 0) return [];
    const map = new Map<string, GroupStats>();
    guests.forEach(g => {
      const gName = g.group_name || "(Sem grupo)";
      if (!map.has(gName)) map.set(gName, { name: gName, total: 0, confirmed: 0, pending: 0, expectedPeople: 0, checkedIn: 0 });
      const s = map.get(gName)!;
      s.total++;
      if (g.status === "confirmed") s.confirmed++;
      if (g.status === "pending") s.pending++;
      if (g.checkin_done) s.checkedIn++;
      s.expectedPeople += (g.confirmed_adults || 0) + (g.confirmed_children || 0);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [guests, groups]);

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      const matchesSearch = guest.name.toLowerCase().includes(search.toLowerCase());
      const matchesGroup = groupFilter === "__all__"
        || (groupFilter === "__none__" && !guest.group_name)
        || guest.group_name === groupFilter;

      let matchesMessage = true;
      if (messageFilter !== "__all__") {
        const guestLogTypes = new Set(messageLogs.filter(l => l.guest_id === guest.id).map(l => l.template_type));
        if (messageFilter === "__none__") {
          matchesMessage = guestLogTypes.size === 0;
        } else if (messageFilter.startsWith("no_")) {
          matchesMessage = !guestLogTypes.has(messageFilter.replace("no_", ""));
        } else {
          matchesMessage = guestLogTypes.has(messageFilter);
        }
      }

      return matchesSearch && matchesGroup && matchesMessage;
    });
  }, [guests, search, groupFilter, messageFilter, messageLogs]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("guests").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Convidado removido", description: "O convidado foi removido com sucesso." });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const handleReset = async () => {
    if (!resetId) return;
    const guest = guests.find(g => g.id === resetId);
    if (!guest) return;
    setResetting(true);
    try {
      const { error } = await supabase.from("guests").update({
        status: "pending", confirmed_adults: 0, confirmed_children: 0,
        checkin_done: false, checkin_at: null, qr_used: false, companions: [], children: [],
      }).eq("id", resetId);
      if (error) throw error;
      toast({ title: "Confirmação redefinida", description: `${guest.name} voltou ao status pendente.` });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao redefinir", description: error.message, variant: "destructive" });
    } finally {
      setResetting(false);
      setResetId(null);
    }
  };

  const handleResendWebhook = async (guest: Guest) => {
    if (!webhookUrl) {
      toast({ title: "Webhook não configurado", description: "Configure a URL do webhook nas configurações do evento.", variant: "destructive" });
      return;
    }
    setSendingWebhook(guest.id);
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resend_notification",
          guest: { id: guest.id, name: guest.name, status: guest.status, confirmed_adults: guest.confirmed_adults, confirmed_children: guest.confirmed_children, qr_code: guest.qr_code },
          event_id: eventId, timestamp: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error("Falha ao enviar webhook");
      toast({ title: "Webhook enviado", description: `Notificação reenviada para ${guest.name}.` });
    } catch (error: any) {
      toast({ title: "Erro ao enviar webhook", description: error.message, variant: "destructive" });
    } finally {
      setSendingWebhook(null);
    }
  };

  const getStatusBadge = (guest: Guest) => {
    if (guest.checkin_done) return (<Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0"><CheckCircle className="h-3 w-3 mr-1" />Check-in</Badge>);
    if (guest.status === "confirmed") return (<Badge className="bg-success/20 text-success hover:bg-success/30 border-0"><QrCode className="h-3 w-3 mr-1" />Confirmado</Badge>);
    if (guest.status === "declined") return (<Badge variant="destructive"><X className="h-3 w-3 mr-1" />Recusado</Badge>);
    return (<Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>);
  };

  const formatCheckinTime = (checkinAt: string | null) => {
    if (!checkinAt) return "-";
    const date = new Date(checkinAt);
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const formatLogDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const MessageIndicators = ({ guestId }: { guestId: string }) => {
    const logsByType = getGuestLogsByType(guestId);
    const types = ["confirmation", "reminder", "extra"] as const;
    const icons = { confirmation: CheckCheck, reminder: Clock, extra: Mail };
    const colors = { confirmation: "text-green-600", reminder: "text-amber-500", extra: "text-blue-500" };

    return (
      <div className="flex items-center gap-1">
        {types.map(type => {
          const log = logsByType[type];
          if (!log) return null;
          const Icon = icons[type];
          const actionLabel = log.action_type === "open_whatsapp" ? "enviado via WhatsApp" : "copiada";
          return (
            <Tooltip key={type}>
              <TooltipTrigger>
                <Icon className={`h-3.5 w-3.5 ${colors[type]}`} />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{TEMPLATE_LABELS[type]} {actionLabel}</p>
                <p className="text-xs text-muted-foreground">{formatLogDate(log.sent_at)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  const WhatsAppMenu = ({ guest }: { guest: Guest }) => {
    if (waTemplates.length === 0) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700">
            <Phone className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!guest.whatsapp ? (
            <DropdownMenuItem disabled className="text-muted-foreground">
              <Phone className="h-4 w-4 mr-2" />Sem WhatsApp cadastrado
            </DropdownMenuItem>
          ) : (
            waTemplates.map((t) => (
              <DropdownMenuSub key={t.id}>
                <DropdownMenuSubTrigger>
                  <MessageSquare className="h-4 w-4 mr-2 text-green-600" />
                  {t.title}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleOpenWhatsApp(guest, t)}>
                    <ExternalLink className="h-4 w-4 mr-2" />Abrir no WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCopyMessage(guest, t)}>
                    <Copy className="h-4 w-4 mr-2" />Copiar mensagem
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const GuestCard = ({ guest }: { guest: Guest }) => (
    <div className="card-elegant p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground truncate">{guest.name}</h3>
            <MessageIndicators guestId={guest.id} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{guest.max_adults || 0}</span>
            <span className="flex items-center gap-1"><Baby className="h-3 w-3" />{guest.max_children || 0}</span>
            {guest.group_name && (<span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{guest.group_name}</span>)}
            {guest.whatsapp && (
              <a href={`https://wa.me/${guest.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-green-600 hover:underline">
                <Phone className="h-3 w-3" />{guest.whatsapp}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(guest)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(guest)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
              {waTemplates.length > 0 && guest.whatsapp && (
                <>
                  <DropdownMenuSeparator />
                  {waTemplates.map((t) => (
                    <DropdownMenuSub key={t.id}>
                      <DropdownMenuSubTrigger>
                        <MessageSquare className="h-4 w-4 mr-2 text-green-600" />{t.title}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => handleOpenWhatsApp(guest, t)}>
                          <ExternalLink className="h-4 w-4 mr-2" />Abrir no WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyMessage(guest, t)}>
                          <Copy className="h-4 w-4 mr-2" />Copiar mensagem
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </>
              )}
              {waTemplates.length > 0 && !guest.whatsapp && (
                <DropdownMenuItem disabled><Phone className="h-4 w-4 mr-2" />Sem WhatsApp</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setResetId(guest.id)} disabled={guest.status === "pending" && !guest.checkin_done}><RotateCcw className="h-4 w-4 mr-2" />Redefinir</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleResendWebhook(guest)}><Send className="h-4 w-4 mr-2" />Reenviar Webhook</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteId(guest.id)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">Confirmados: <span className="text-foreground font-medium">{(guest.confirmed_adults || 0) + (guest.confirmed_children || 0)}</span></span>
          {guest.checkin_done && (<span className="text-success text-xs">Check-in: {formatCheckinTime(guest.checkin_at)}</span>)}
        </div>
        {guest.observations && (
          <Tooltip><TooltipTrigger><MessageSquare className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-xs"><p className="text-sm">{guest.observations}</p></TooltipContent></Tooltip>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Search + Group Filter + Message Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-lg" />
        </div>
        {groups.length > 0 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Grupo/Família" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os grupos</SelectItem>
              <SelectItem value="__none__">(Sem grupo)</SelectItem>
              {groups.map(g => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
        {waTemplates.length > 0 && (
          <Select value={messageFilter} onValueChange={setMessageFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <MessageSquare className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtro mensagens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as mensagens</SelectItem>
              <SelectItem value="__none__">Sem mensagem enviada</SelectItem>
              <SelectItem value="confirmation">Com confirmação enviada</SelectItem>
              <SelectItem value="reminder">Com lembrete enviado</SelectItem>
              <SelectItem value="extra">Com extra enviado</SelectItem>
              <SelectItem value="no_confirmation">Sem confirmação</SelectItem>
              <SelectItem value="no_reminder">Sem lembrete</SelectItem>
              <SelectItem value="no_extra">Sem extra</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Group Stats Summary */}
      {groups.length > 0 && groupFilter !== "__all__" && (
        <div className="mb-6">
          {groupStats.filter(gs => groupFilter === "__all__" || gs.name === groupFilter || (groupFilter === "__none__" && gs.name === "(Sem grupo)")).map(gs => (
            <div key={gs.name} className="card-elegant p-4 flex flex-wrap gap-4 items-center text-sm">
              <span className="font-medium text-foreground">{gs.name}</span>
              <Badge variant="secondary">{gs.total} convidados</Badge>
              <Badge className="bg-success/20 text-success border-0">{gs.confirmed} confirmados</Badge>
              <Badge variant="secondary">{gs.pending} pendentes</Badge>
              <Badge variant="outline">{gs.expectedPeople} pessoas esperadas</Badge>
              {gs.checkedIn > 0 && <Badge className="bg-blue-100 text-blue-700 border-0">{gs.checkedIn} check-ins</Badge>}
            </div>
          ))}
        </div>
      )}

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredGuests.length === 0 ? (
          <div className="card-elegant p-8 text-center text-muted-foreground">
            {search || groupFilter !== "__all__" || messageFilter !== "__all__" ? "Nenhum convidado encontrado" : "Nenhum convidado cadastrado"}
          </div>
        ) : (
          filteredGuests.map((guest) => (<GuestCard key={guest.id} guest={guest} />))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block card-elegant overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Nome</TableHead>
              {groups.length > 0 && <TableHead>Grupo</TableHead>}
              <TableHead className="text-center">Adultos</TableHead>
              <TableHead className="text-center">Crianças</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Conf.</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead className="text-center">Msgs</TableHead>
              <TableHead className="text-center">Check-in</TableHead>
              <TableHead className="text-center">Obs.</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGuests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={groups.length > 0 ? 12 : 11} className="text-center py-8 text-muted-foreground">
                  {search || groupFilter !== "__all__" || messageFilter !== "__all__" ? "Nenhum convidado encontrado" : "Nenhum convidado cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              filteredGuests.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">{guest.name}</TableCell>
                  {groups.length > 0 && (<TableCell className="text-muted-foreground text-sm">{guest.group_name || "-"}</TableCell>)}
                  <TableCell className="text-center">{guest.max_adults || 0}</TableCell>
                  <TableCell className="text-center">{guest.max_children || 0}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(guest)}</TableCell>
                  <TableCell className="text-center">{(guest.confirmed_adults || 0) + (guest.confirmed_children || 0)}</TableCell>
                  <TableCell className="text-sm">
                    {guest.whatsapp ? (
                      <a href={`https://wa.me/${guest.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline whitespace-nowrap">
                        {guest.whatsapp}
                      </a>
                    ) : (<span className="text-muted-foreground">-</span>)}
                  </TableCell>
                  <TableCell className="text-center">
                    <MessageIndicators guestId={guest.id} />
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {guest.checkin_done ? (<span className="text-success">{formatCheckinTime(guest.checkin_at)}</span>) : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {guest.observations ? (
                      <Tooltip><TooltipTrigger><MessageSquare className="h-4 w-4 text-muted-foreground mx-auto" /></TooltipTrigger><TooltipContent className="max-w-xs"><p className="text-sm">{guest.observations}</p></TooltipContent></Tooltip>
                    ) : (<span className="text-muted-foreground">-</span>)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit?.(guest)}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
                      <WhatsAppMenu guest={guest} />
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetId(guest.id)} disabled={guest.status === "pending" && !guest.checkin_done}><RotateCcw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Redefinir confirmação</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => handleResendWebhook(guest)} disabled={sendingWebhook === guest.id}><Send className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Reenviar Webhook</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(guest.id)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Deletar</TooltipContent></Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={!!resetId} onOpenChange={() => setResetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir confirmação?</AlertDialogTitle>
            <AlertDialogDescription>O convidado voltará ao status "Pendente". A confirmação será removida, mas as informações cadastrais serão mantidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={resetting} className="bg-warning text-warning-foreground hover:bg-warning/90">{resetting ? "Redefinindo..." : "Redefinir"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover convidado?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. O convidado será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? "Removendo..." : "Remover"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GuestTable;
