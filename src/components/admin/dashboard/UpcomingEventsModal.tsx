import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Users, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, differenceInHours, isBefore, addHours } from "date-fns";
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
  confirmed_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UpcomingEventsModal = ({ open, onOpenChange }: Props) => {
  const [events, setEvents] = useState<EventWithOwner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchUpcomingEvents();
    }
  }, [open]);

  const fetchUpcomingEvents = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_events" },
      });

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const upcoming = (eventsData.events || [])
        .filter((e: EventWithOwner) => new Date(e.event_date) >= today)
        .sort((a: EventWithOwner, b: EventWithOwner) => 
          new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
        );

      // Fetch guest counts
      if (upcoming.length > 0) {
        const eventIds = upcoming.map((e: EventWithOwner) => e.id);
        const { data: guests } = await supabase
          .from("guests")
          .select("event_id, status")
          .in("event_id", eventIds);

        if (guests) {
          const counts: Record<string, { total: number; confirmed: number }> = {};
          guests.forEach((g) => {
            if (!counts[g.event_id]) {
              counts[g.event_id] = { total: 0, confirmed: 0 };
            }
            counts[g.event_id].total++;
            if (g.status === "confirmed") counts[g.event_id].confirmed++;
          });

          upcoming.forEach((e: EventWithOwner) => {
            e.guest_count = counts[e.id]?.total || 0;
            e.confirmed_count = counts[e.id]?.confirmed || 0;
          });
        }
      }

      setEvents(upcoming);
    } catch (err) {
      console.error("Error fetching upcoming events:", err);
    } finally {
      setLoading(false);
    }
  };

  const isWithin48Hours = (eventDate: string) => {
    const now = new Date();
    const date = new Date(eventDate);
    return differenceInHours(date, now) <= 48 && !isBefore(date, now);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Eventos Próximos
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
              Nenhum evento agendado
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border ${
                  isWithin48Hours(event.event_date)
                    ? "bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/30"
                    : "bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{event.name}</p>
                      {isWithin48Hours(event.event_date) && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Em breve
                        </Badge>
                      )}
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
                        {event.confirmed_count}/{event.guest_count} confirmados
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
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UpcomingEventsModal;
