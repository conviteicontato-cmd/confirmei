import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Clock, QrCode, CheckCircle, MessageSquare, X, Users, Baby, FolderOpen, Filter } from "lucide-react";
import type { Guest } from "./EventManagement";

interface GuestTableReadOnlyProps {
  guests: Guest[];
}

const GuestTableReadOnly = ({ guests }: GuestTableReadOnlyProps) => {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");

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
      const matchesStatus = statusFilter === "__all__"
        || (statusFilter === "confirmed" && guest.status === "confirmed" && !guest.checkin_done)
        || (statusFilter === "pending" && guest.status === "pending")
        || (statusFilter === "checkin" && guest.checkin_done);
      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [guests, search, groupFilter, statusFilter]);

  const getStatusBadge = (guest: Guest) => {
    if (guest.checkin_done) {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0"><CheckCircle className="h-3 w-3 mr-1" />Check-in</Badge>;
    }
    if (guest.status === "confirmed") {
      return <Badge className="bg-success/20 text-success hover:bg-success/30 border-0"><QrCode className="h-3 w-3 mr-1" />Confirmado</Badge>;
    }
    if (guest.status === "declined") {
      return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Recusado</Badge>;
    }
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
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
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{guest.max_adults || 0}</span>
            <span className="flex items-center gap-1"><Baby className="h-3 w-3" />{guest.max_children || 0}</span>
            {guest.group_name && (
              <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{guest.group_name}</span>
            )}
          </div>
        </div>
        {getStatusBadge(guest)}
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">Confirmados: <span className="text-foreground font-medium">{(guest.confirmed_adults || 0) + (guest.confirmed_children || 0)}</span></span>
          {guest.checkin_done && <span className="text-success text-xs">Check-in: {formatCheckinTime(guest.checkin_at)}</span>}
        </div>
        {guest.observations && (
          <Tooltip><TooltipTrigger><MessageSquare className="h-4 w-4 text-muted-foreground" /></TooltipTrigger><TooltipContent className="max-w-xs"><p className="text-sm">{guest.observations}</p></TooltipContent></Tooltip>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 rounded-lg" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os status</SelectItem>
            <SelectItem value="confirmed">Confirmados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="checkin">Check-in</SelectItem>
          </SelectContent>
        </Select>
        {groups.length > 0 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Grupo/Família" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os grupos</SelectItem>
              <SelectItem value="__none__">(Sem grupo)</SelectItem>
              {groups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredGuests.length === 0 ? (
          <div className="card-elegant p-8 text-center text-muted-foreground">
            {search || groupFilter !== "__all__" || statusFilter !== "__all__" ? "Nenhum convidado encontrado" : "Nenhum convidado cadastrado"}
          </div>
        ) : (
          filteredGuests.map((guest) => <GuestCard key={guest.id} guest={guest} />)
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGuests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={groups.length > 0 ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  {search || groupFilter !== "__all__" || statusFilter !== "__all__" ? "Nenhum convidado encontrado" : "Nenhum convidado cadastrado"}
                </TableCell>
              </TableRow>
            ) : (
              filteredGuests.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">{guest.name}</TableCell>
                  {groups.length > 0 && <TableCell className="text-muted-foreground text-sm">{guest.group_name || "-"}</TableCell>}
                  <TableCell className="text-center">{guest.max_adults || 0}</TableCell>
                  <TableCell className="text-center">{guest.max_children || 0}</TableCell>
                  <TableCell className="text-center">{getStatusBadge(guest)}</TableCell>
                  <TableCell className="text-center">{(guest.confirmed_adults || 0) + (guest.confirmed_children || 0)}</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {guest.checkin_done ? <span className="text-success">{formatCheckinTime(guest.checkin_at)}</span> : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {guest.observations ? (
                      <Tooltip><TooltipTrigger><MessageSquare className="h-4 w-4 text-muted-foreground mx-auto" /></TooltipTrigger><TooltipContent className="max-w-xs"><p className="text-sm">{guest.observations}</p></TooltipContent></Tooltip>
                    ) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
};

export default GuestTableReadOnly;
