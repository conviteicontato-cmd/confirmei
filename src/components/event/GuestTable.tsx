import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Pencil, Trash2, RotateCcw, Send, Clock, QrCode, CheckCircle, MessageSquare, X, MoreVertical, Users, Baby, FolderOpen, Phone } from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import type { Guest } from "./EventManagement";

interface GuestTableProps {
  guests: Guest[];
  eventId: string;
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

const GuestTable = ({ guests, eventId, webhookUrl, onRefresh, onEdit }: GuestTableProps) => {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetId, setResetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [sendingWebhook, setSendingWebhook] = useState<string | null>(null);
  const { toast } = useToast();

  // Compute unique groups
  const groups = useMemo(() => {
    const set = new Set<string>();
    guests.forEach(g => {
      if (g.group_name) set.add(g.group_name);
    });
    return Array.from(set).sort();
  }, [guests]);

  // Compute group stats
  const groupStats = useMemo((): GroupStats[] => {
    if (groups.length === 0) return [];
    const map = new Map<string, GroupStats>();
    guests.forEach(g => {
      const gName = g.group_name || "(Sem grupo)";
      if (!map.has(gName)) {
        map.set(gName, { name: gName, total: 0, confirmed: 0, pending: 0, expectedPeople: 0, checkedIn: 0 });
      }
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
      return matchesSearch && matchesGroup;
    });
  }, [guests, search, groupFilter]);

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
    if (guest.checkin_done) {
      return (<Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0"><CheckCircle className="h-3 w-3 mr-1" />Check-in</Badge>);
    }
    if (guest.status === "confirmed") {
      return (<Badge className="bg-success/20 text-success hover:bg-success/30 border-0"><QrCode className="h-3 w-3 mr-1" />Confirmado</Badge>);
    }
    if (guest.status === "declined") {
      return (<Badge variant="destructive"><X className="h-3 w-3 mr-1" />Recusado</Badge>);
    }
    return (<Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>);
  };

  const formatCheckinTime = (checkinAt: string | null) => {
    if (!checkinAt) return "-";
    const date = new Date(checkinAt);
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const GuestCard = ({ guest }: { guest: Guest }) => (
    <div className="card-elegant p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{guest.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{guest.max_adults || 0}</span>
            <span className="flex items-center gap-1"><Baby className="h-3 w-3" />{guest.max_children || 0}</span>
            {guest.group_name && (
              <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{guest.group_name}</span>
            )}
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
              <DropdownMenuItem onClick={() => setResetId(guest.id)} disabled={guest.status === "pending" && !guest.checkin_done}><RotateCcw className="h-4 w-4 mr-2" />Redefinir</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleResendWebhook(guest)}><Send className="h-4 w-4 mr-2" />Reenviar Make</DropdownMenuItem>
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
      {/* Search + Group Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-lg"
          />
        </div>
        {groups.length > 0 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Grupo/Família" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os grupos</SelectItem>
              <SelectItem value="__none__">(Sem grupo)</SelectItem>
              {groups.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
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
            {search || groupFilter !== "__all__" ? "Nenhum convidado encontrado" : "Nenhum convidado cadastrado"}
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
              <TableHead className="text-center">Check-in</TableHead>
              <TableHead className="text-center">Obs.</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGuests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={groups.length > 0 ? 9 : 8} className="text-center py-8 text-muted-foreground">
                  {search || groupFilter !== "__all__" ? "Nenhum convidado encontrado" : "Nenhum convidado cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              filteredGuests.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">{guest.name}</TableCell>
                  {groups.length > 0 && (
                    <TableCell className="text-muted-foreground text-sm">{guest.group_name || "-"}</TableCell>
                  )}
                  <TableCell className="text-center">{guest.max_adults || 0}</TableCell>
                  <TableCell className="text-center">{guest.max_children || 0}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(guest)}</TableCell>
                  <TableCell className="text-center">{(guest.confirmed_adults || 0) + (guest.confirmed_children || 0)}</TableCell>
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
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetId(guest.id)} disabled={guest.status === "pending" && !guest.checkin_done}><RotateCcw className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Redefinir confirmação</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => handleResendWebhook(guest)} disabled={sendingWebhook === guest.id}><Send className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Reenviar Make</TooltipContent></Tooltip>
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
