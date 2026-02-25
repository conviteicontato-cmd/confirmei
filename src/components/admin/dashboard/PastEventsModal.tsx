import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Users, ExternalLink, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventWithOwner {
  id: string;
  name: string;
  event_date: string;
  owner?: {
    full_name: string;
    email: string;
  };
  guest_count: number;
  checkin_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventsUpdated?: () => void;
}

const PastEventsModal = ({ open, onOpenChange, onEventsUpdated }: Props) => {
  const [events, setEvents] = useState<EventWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [deletingEvents, setDeletingEvents] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPastEvents();
      setSelectedEvents([]);
    }
  }, [open]);

  const fetchPastEvents = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_events" },
      });

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const past = (eventsData.events || [])
        .filter((e: EventWithOwner) => new Date(e.event_date) < today)
        .sort((a: EventWithOwner, b: EventWithOwner) => 
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        );

      // Fetch guest counts
      if (past.length > 0) {
        const eventIds = past.map((e: EventWithOwner) => e.id);
        const { data: guests } = await supabase
          .from("guests")
          .select("event_id, checkin_done")
          .in("event_id", eventIds);

        if (guests) {
          const counts: Record<string, { total: number; checkedIn: number }> = {};
          guests.forEach((g) => {
            if (!counts[g.event_id]) {
              counts[g.event_id] = { total: 0, checkedIn: 0 };
            }
            counts[g.event_id].total++;
            if (g.checkin_done) counts[g.event_id].checkedIn++;
          });

          past.forEach((e: EventWithOwner) => {
            e.guest_count = counts[e.id]?.total || 0;
            e.checkin_count = counts[e.id]?.checkedIn || 0;
          });
        }
      }

      setEvents(past);
    } catch (err) {
      console.error("Error fetching past events:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedEvents.length === 0) return;
    
    setDeletingEvents(true);
    try {
      for (const eventId of selectedEvents) {
        await supabase.functions.invoke("admin-operations", {
          body: { action: "delete_event", eventId },
        });
      }
      
      toast({ 
        title: `${selectedEvents.length} evento(s) excluído(s)` 
      });
      
      fetchPastEvents();
      setSelectedEvents([]);
      onEventsUpdated?.();
    } catch (err) {
      toast({
        title: "Erro ao excluir eventos",
        variant: "destructive",
      });
    } finally {
      setDeletingEvents(false);
    }
  };

  const getAttendanceRate = (checkins: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((checkins / total) * 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-muted-foreground" />
            Eventos Finalizados
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Nenhum evento finalizado ainda
            </p>
          </div>
        ) : (
          <>
            {selectedEvents.length > 0 && (
              <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="text-sm">{selectedEvents.length} selecionado(s)</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  disabled={deletingEvents}
                >
                  {deletingEvents ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Excluir selecionados"
                  )}
                </Button>
              </div>
            )}
            
            <div className="space-y-3">
              {events.map((event) => {
                const attendanceRate = getAttendanceRate(event.checkin_count, event.guest_count);
                return (
                  <div
                    key={event.id}
                    className="p-3 bg-muted/30 border border-border rounded-lg opacity-80"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedEvents.includes(event.id)}
                        onCheckedChange={() => toggleEventSelection(event.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-muted-foreground">{event.name}</p>
                          <Badge variant="secondary" className="text-xs">
                            {attendanceRate}% comparecimento
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {event.owner?.full_name || "Organizador"}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            {event.checkin_count}/{event.guest_count} check-ins
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/event/${event.id}`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PastEventsModal;
