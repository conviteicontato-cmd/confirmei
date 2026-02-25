import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, Users, Eye, Loader2, ExternalLink } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventWithOwner {
  id: string;
  name: string;
  event_date: string;
  user_id: string;
  created_at: string;
  cover_image_url: string | null;
  owner?: {
    user_id: string;
    full_name: string;
    email: string;
  };
}

const AdminEvents = () => {
  const [events, setEvents] = useState<EventWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [guestCounts, setGuestCounts] = useState<Record<string, { total: number; confirmed: number; checkedIn: number }>>({});
  const { toast } = useToast();

  useEffect(() => {
    async function fetchEvents() {
      try {
        const { data, error } = await supabase.functions.invoke("admin-operations", {
          body: { action: "get_all_events" },
        });

        if (error) throw error;
        setEvents(data.events || []);

        // Fetch guest counts for each event
        const eventIds = (data.events || []).map((e: EventWithOwner) => e.id);
        if (eventIds.length > 0) {
          const { data: guests } = await supabase
            .from("guests")
            .select("event_id, status, checkin_done")
            .in("event_id", eventIds);

          if (guests) {
            const counts: Record<string, { total: number; confirmed: number; checkedIn: number }> = {};
            guests.forEach((g) => {
              if (!counts[g.event_id]) {
                counts[g.event_id] = { total: 0, confirmed: 0, checkedIn: 0 };
              }
              counts[g.event_id].total++;
              if (g.status === "confirmed") counts[g.event_id].confirmed++;
              if (g.checkin_done) counts[g.event_id].checkedIn++;
            });
            setGuestCounts(counts);
          }
        }
      } catch (err) {
        console.error("Error fetching events:", err);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os eventos",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.owner?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.owner?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getEventStatus = (eventDate: string) => {
    const today = startOfDay(new Date());
    const date = new Date(eventDate);
    
    if (isBefore(date, today)) {
      return <Badge variant="secondary">Finalizado</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Agendado</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Gestão de Eventos
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualizar e gerenciar todos os eventos do sistema
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{events.length}</div>
          <div className="text-sm text-muted-foreground">Total de Eventos</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {events.filter((e) => !isBefore(new Date(e.event_date), startOfDay(new Date()))).length}
          </div>
          <div className="text-sm text-muted-foreground">Agendados</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">
            {events.filter((e) => isBefore(new Date(e.event_date), startOfDay(new Date()))).length}
          </div>
          <div className="text-sm text-muted-foreground">Finalizados</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">
            {Object.values(guestCounts).reduce((sum, c) => sum + c.total, 0)}
          </div>
          <div className="text-sm text-muted-foreground">Total Convidados</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar eventos ou organizadores..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Events Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead className="hidden md:table-cell">Organizador</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="hidden sm:table-cell">Convidados</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum evento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredEvents.map((event) => {
                const counts = guestCounts[event.id] || { total: 0, confirmed: 0, checkedIn: 0 };
                return (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {event.cover_image_url ? (
                          <img
                            src={event.cover_image_url}
                            alt={event.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{event.name}</div>
                          <div className="text-sm text-muted-foreground md:hidden">
                            {event.owner?.full_name || "—"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div>
                        <div className="font-medium">{event.owner?.full_name || "—"}</div>
                        <div className="text-sm text-muted-foreground">{event.owner?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{counts.confirmed}/{counts.total}</span>
                        {counts.checkedIn > 0 && (
                          <span className="text-green-600 text-sm ml-1">
                            ({counts.checkedIn} check-in)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getEventStatus(event.event_date)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/event/${event.id}`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminEvents;
