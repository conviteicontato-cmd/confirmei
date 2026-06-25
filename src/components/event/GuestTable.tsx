import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search, Pencil, Trash2, RotateCcw, QrCode, FolderOpen, Clock, Check, ChevronLeft, ChevronRight, ChevronDown,
  MessageSquare, ExternalLink, Copy, Phone,
} from "lucide-react";
import type { Guest } from "./EventManagement";

interface WhatsAppTemplate {
  id: string;
  template_type: string;
  title: string;
  message_body: string;
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

const PAGE_SIZE = 8;

const AVATAR_PALETTE = [
  { bg: "#f4e7e0", color: "#7a1b2a" },
  { bg: "#e6f1ea", color: "#2f8f63" },
  { bg: "#f6ecda", color: "#b07d22" },
  { bg: "#fbe7ee", color: "#d44e7d" },
  { bg: "#e7ecf6", color: "#3a5fb0" },
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const avatarFor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const statusMeta = (guest: Guest) => {
  if (guest.checkin_done) return { label: "Check-in", color: "#d44e7d", bg: "#fbe7ee" };
  if (guest.status === "confirmed") return { label: "Confirmado", color: "#2f8f63", bg: "#e6f1ea" };
  if (guest.status === "declined" || guest.status === "canceled") return { label: "Recusado", color: "#c0392b", bg: "#f7e7e7" };
  return { label: "Pendente", color: "#b07d22", bg: "#f6ecda" };
};

const GuestTable = ({ guests, eventId, eventName, eventDate, webhookUrl, onRefresh, onEdit }: GuestTableProps) => {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("event_id", eventId)
      .then(({ data }) => {
        if (data) setWaTemplates(data as WhatsAppTemplate[]);
      });
  }, [eventId]);

  const buildMessage = (guest: Guest, template: WhatsAppTemplate): string => {
    let msg = template.message_body;
    msg = msg.replace(/\{\{nome_convidado\}\}/g, guest.name);
    msg = msg.replace(/\{\{nome_evento\}\}/g, eventName || "");
    msg = msg.replace(/\{\{data_evento\}\}/g, eventDate ? new Date(eventDate + "T12:00:00").toLocaleDateString("pt-BR") : "");
    msg = msg.replace(/\{\{link_confirmacao\}\}/g, `${window.location.origin}/confirmar/${eventId}`);
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
  };

  const handleOpenWhatsApp = async (guest: Guest, template: WhatsAppTemplate) => {
    if (!guest.whatsapp) {
      toast({ title: "Sem WhatsApp", description: `${guest.name} não possui número cadastrado.`, variant: "destructive" });
      return;
    }
    if (!template.message_body.trim()) {
      toast({ title: "Template vazio", description: `O template "${template.title}" está sem conteúdo.`, variant: "destructive" });
      return;
    }
    const phone = guest.whatsapp.replace(/[^0-9]/g, "");
    const msg = buildMessage(guest, template);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    await logMessageAction(guest, template, "open_whatsapp");
  };

  const handleCopyMessage = async (guest: Guest, template: WhatsAppTemplate) => {
    if (!template.message_body.trim()) {
      toast({ title: "Template vazio", description: `O template "${template.title}" está sem conteúdo.`, variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(buildMessage(guest, template));
      await logMessageAction(guest, template, "copy_message");
      toast({ title: "Mensagem copiada", description: `Texto copiado para ${guest.name}.` });
    } catch {
      toast({ title: "Erro ao copiar", description: "Não foi possível copiar a mensagem.", variant: "destructive" });
    }
  };

  const groups = useMemo(() => {
    const set = new Set<string>();
    guests.forEach(g => { if (g.group_name) set.add(g.group_name); });
    return Array.from(set).sort();
  }, [guests]);

  const filteredGuests = useMemo(() => {
    return guests.filter((guest) => {
      const matchesSearch = guest.name.toLowerCase().includes(search.toLowerCase());
      const matchesGroup = groupFilter === "__all__"
        || (groupFilter === "__none__" && !guest.group_name)
        || guest.group_name === groupFilter;
      let matchesStatus = true;
      if (statusFilter !== "__all__") {
        if (statusFilter === "checkedin") matchesStatus = !!guest.checkin_done;
        else if (statusFilter === "confirmed") matchesStatus = guest.status === "confirmed" && !guest.checkin_done;
        else if (statusFilter === "pending") matchesStatus = guest.status === "pending" || guest.status === null;
        else if (statusFilter === "declined") matchesStatus = guest.status === "declined" || guest.status === "canceled";
      }
      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [guests, search, groupFilter, statusFilter]);

  useEffect(() => { setPage(0); }, [search, groupFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageGuests = filteredGuests.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

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

  const groupLabel = groupFilter === "__all__" ? "Todos os grupos" : groupFilter === "__none__" ? "(Sem grupo)" : groupFilter;
  const statusLabels: Record<string, string> = {
    __all__: "Todos os status", pending: "Pendentes", confirmed: "Confirmados", declined: "Recusados", checkedin: "Check-in",
  };

  const ActionButtons = ({ guest }: { guest: Guest }) => (
    <div className="flex items-center justify-end gap-1">
      {guest.qr_code ? (
        <a
          href={`/ingresso/${guest.qr_code}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver QR Code / ingresso"
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[#9a8478] hover:bg-[#f4e7e0] hover:text-[#7a1b2a] transition-colors"
        >
          <QrCode className="w-[15px] h-[15px]" strokeWidth={1.8} />
        </a>
      ) : (
        <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[#d8ccbe]" title="Sem ingresso">
          <QrCode className="w-[15px] h-[15px]" strokeWidth={1.8} />
        </span>
      )}
      <button
        onClick={() => onEdit?.(guest)}
        title="Editar convidado"
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[#9a8478] hover:bg-[#f4e7e0] hover:text-[#7a1b2a] transition-colors"
      >
        <Pencil className="w-[15px] h-[15px]" strokeWidth={1.8} />
      </button>
      {waTemplates.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Enviar mensagem no WhatsApp"
              className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[#2f8f63] hover:bg-[#e6f1ea] transition-colors"
            >
              <MessageSquare className="w-[15px] h-[15px]" strokeWidth={1.8} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <span className="text-[10.5px] font-bold tracking-wide uppercase text-[#b3a194]">Enviar para</span>
              <p className="text-sm font-semibold text-[#3a0a10] truncate">{guest.name}</p>
              <p className="text-xs text-[#9a8478]">{guest.whatsapp || "Sem WhatsApp"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!guest.whatsapp ? (
              <DropdownMenuItem disabled><Phone className="h-4 w-4 mr-2" />Sem WhatsApp cadastrado</DropdownMenuItem>
            ) : (
              waTemplates.map((t) => (
                <DropdownMenuSub key={t.id}>
                  <DropdownMenuSubTrigger>
                    <MessageSquare className="h-4 w-4 mr-2 text-[#2f8f63]" />{t.title}
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
      )}
      <button
        onClick={() => setResetId(guest.id)}
        disabled={guest.status === "pending" && !guest.checkin_done}
        title="Redefinir confirmação"
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[#9a8478] hover:bg-[#f6ecda] hover:text-[#b07d22] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#9a8478]"
      >
        <RotateCcw className="w-[15px] h-[15px]" strokeWidth={1.8} />
      </button>
      <button
        onClick={() => setDeleteId(guest.id)}
        title="Remover convidado"
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[#9a8478] hover:bg-[#f7e7e7] hover:text-[#c0392b] transition-colors"
      >
        <Trash2 className="w-[15px] h-[15px]" strokeWidth={1.8} />
      </button>
    </div>
  );

  const peopleLabel = (guest: Guest) => `${guest.max_adults || 0}A · ${guest.max_children || 0}C`;

  return (
    <>
      {/* filters */}
      <div className="flex items-center gap-[10px] mb-4 flex-wrap">
        <div className="flex items-center gap-[9px] bg-white border border-[#e6dccf] rounded-[11px] px-[14px] py-[9px] flex-1 min-w-[220px] focus-within:border-[#7a1b2a] transition-colors">
          <Search className="w-4 h-4 text-[#9a8478]" strokeWidth={1.9} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar convidado…"
            className="flex-1 border-none outline-none bg-transparent text-[13.5px] text-[#3a0a10] placeholder:text-[#9a8478]"
          />
        </div>

        {groups.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 bg-white border border-[#e6dccf] rounded-[11px] px-[14px] py-[9px] text-[#5e3b32] hover:bg-[#fbf7f1] transition-colors">
                <FolderOpen className="w-[15px] h-[15px] text-[#b3a194]" strokeWidth={1.9} />
                <span className="text-[13.5px] font-medium">{groupLabel}</span>
                <ChevronDown className="w-[14px] h-[14px] text-[#b3a194]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => setGroupFilter("__all__")}>Todos os grupos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupFilter("__none__")}>(Sem grupo)</DropdownMenuItem>
              {groups.map(g => (
                <DropdownMenuItem key={g} onClick={() => setGroupFilter(g)}>{g}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 bg-white border border-[#e6dccf] rounded-[11px] px-[14px] py-[9px] text-[#5e3b32] hover:bg-[#fbf7f1] transition-colors">
              <Clock className="w-[15px] h-[15px] text-[#b3a194]" strokeWidth={1.9} />
              <span className="text-[13.5px] font-medium">{statusLabels[statusFilter]}</span>
              <ChevronDown className="w-[14px] h-[14px] text-[#b3a194]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => setStatusFilter("__all__")}>Todos os status</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pendentes</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("confirmed")}>Confirmados</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("checkedin")}>Check-in</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter("declined")}>Recusados</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* table */}
      <div className="bg-white border border-[#ece2d5] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            {/* header */}
            <div className="grid grid-cols-[2.1fr_1.2fr_1.2fr_0.9fr_1.3fr_1.2fr] gap-3 px-[22px] py-[13px] bg-[#faf6f0] border-b border-[#efe6db] text-[11.5px] font-semibold tracking-[0.6px] uppercase text-[#b3a194]">
              <span>Convidado</span>
              <span>Grupo</span>
              <span className="text-center">Status</span>
              <span className="text-center">Pessoas</span>
              <span>WhatsApp</span>
              <span className="text-right">Ações</span>
            </div>

            {pageGuests.length === 0 ? (
              <div className="flex items-center justify-center gap-[9px] px-[22px] py-[34px] text-[#9a8478]">
                <Search className="w-[18px] h-[18px] text-[#b3a194]" strokeWidth={1.9} />
                <span className="text-[13.5px]">Nenhum convidado encontrado para esses filtros.</span>
              </div>
            ) : (
              pageGuests.map((guest) => {
                const av = avatarFor(guest.name);
                const st = statusMeta(guest);
                return (
                  <div
                    key={guest.id}
                    className="grid grid-cols-[2.1fr_1.2fr_1.2fr_0.9fr_1.3fr_1.2fr] gap-3 px-[22px] py-[14px] items-center border-b border-[#f3ece2] hover:bg-[#fdfaf6] transition-colors"
                  >
                    <div className="flex items-center gap-[11px] min-w-0">
                      <div
                        className="w-[34px] h-[34px] rounded-full flex-none flex items-center justify-center text-[12.5px] font-semibold"
                        style={{ background: av.bg, color: av.color }}
                      >
                        {getInitials(guest.name)}
                      </div>
                      <span className="text-sm font-semibold text-[#3a0a10] truncate">{guest.name}</span>
                    </div>
                    <span className="text-[13px] text-[#9a8478] truncate">{guest.group_name || "—"}</span>
                    <div className="flex justify-center">
                      <span
                        className="inline-flex items-center gap-[5px] text-xs font-semibold px-[11px] py-1 rounded-full whitespace-nowrap"
                        style={{ color: st.color, background: st.bg }}
                      >
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: st.color }} />
                        {st.label}
                      </span>
                    </div>
                    <span className="text-[13px] text-[#5e3b32] text-center whitespace-nowrap">{peopleLabel(guest)}</span>
                    <span className="text-[13px] text-[#9a8478] truncate">{guest.whatsapp || "—"}</span>
                    <ActionButtons guest={guest} />
                  </div>
                );
              })
            )}

            {/* pagination */}
            <div className="flex items-center justify-between px-[22px] py-[13px] text-[12.5px] text-[#9a8478]">
              <span>
                {filteredGuests.length} {filteredGuests.length === 1 ? "convidado" : "convidados"}
              </span>
              <div className="flex items-center gap-[6px]">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="w-[30px] h-[30px] rounded-lg border border-[#e6dccf] bg-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed text-[#5e3b32] hover:bg-[#fbf7f1] transition-colors"
                >
                  <ChevronLeft className="w-[14px] h-[14px]" />
                </button>
                <span className="px-1">{currentPage + 1} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="w-[30px] h-[30px] rounded-lg border border-[#e6dccf] bg-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed text-[#5e3b32] hover:bg-[#fbf7f1] transition-colors"
                >
                  <ChevronRight className="w-[14px] h-[14px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
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
