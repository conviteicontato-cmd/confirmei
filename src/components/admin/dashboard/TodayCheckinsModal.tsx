import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Users, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventWithCheckins {
  id: string;
  name: string;
  event_date: string;
  owner?: {
    full_name: string;
  };
  total_guests: number;
  checkins_done: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TodayCheckinsModal = ({ open, onOpenChange }: Props) => {
  const [events, setEvents] = useState<EventWithCheckins[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTodayEvents = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      const { data: eventsData, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_events" },
      });

      if (error) throw error;

      const todayEvents = (eventsData.events || [])
        .filter((e: EventWithCheckins) => e.event_date === today);

      if (todayEvents.length > 0) {
        const eventIds = todayEvents.map((e: EventWithCheckins) => e.id);
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

          todayEvents.forEach((e: EventWithCheckins) => {
            e.total_guests = counts[e.id]?.total || 0;
            e.checkins_done = counts[e.id]?.checkedIn || 0;
          });
        }
      }

      setEvents(todayEvents);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error fetching today's events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchTodayEvents();

      // Auto-refresh every 30 seconds
      refreshIntervalRef.current = setInterval(() => {
        fetchTodayEvents();
      }, 30000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-500" />
              Check-ins de Hoje
            </DialogTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Atualiza a cada 30s</span>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Nenhum evento acontecendo hoje ({format(new Date(), "dd/MM/yyyy", { locale: ptBR })})
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-right">
              Última atualização: {format(lastRefresh, "HH:mm:ss", { locale: ptBR })}
            </p>
            
            {events.map((event) => {
              const percentage = event.total_guests > 0
                ? Math.round((event.checkins_done / event.total_guests) * 100)
                : 0;
              
              return (
                <div
                  key={event.id}
                  className="p-4 bg-green-50/50 dark:bg-green-500/5 border border-green-200/50 dark:border-green-500/20 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{event.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.owner?.full_name || "Organizador"}
                      </p>
                      
                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Check-ins realizados</span>
                          <span className="font-medium text-green-600">
                            {event.checkins_done}/{event.total_guests} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-3"
                      onClick={() => window.open(`/event/${event.id}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Check-in
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TodayCheckinsModal;
