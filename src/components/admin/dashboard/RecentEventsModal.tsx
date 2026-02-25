import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Calendar, ExternalLink, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, subDays, subHours, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentEvent {
  id: string;
  name: string;
  event_date: string;
  created_at: string;
  owner?: {
    full_name: string;
    email: string;
  };
}

type Period = "24h" | "7d" | "30d";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
}

const RecentEventsModal = ({ open, onOpenChange, period }: Props) => {
  const [events, setEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);

  const getPeriodLabel = () => {
    switch (period) {
      case "24h": return "Últimas 24 horas";
      case "7d": return "Últimos 7 dias";
      case "30d": return "Últimos 30 dias";
    }
  };

  useEffect(() => {
    if (open) {
      fetchRecentEvents();
    }
  }, [open, period]);

  const fetchRecentEvents = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_events" },
      });

      if (error) throw error;

      const now = new Date();
      let cutoffDate: Date;

      switch (period) {
        case "24h":
          cutoffDate = subHours(now, 24);
          break;
        case "7d":
          cutoffDate = subDays(now, 7);
          break;
        case "30d":
          cutoffDate = subDays(now, 30);
          break;
      }

      const filtered = (eventsData.events || [])
        .filter((e: RecentEvent) => new Date(e.created_at) >= cutoffDate)
        .sort((a: RecentEvent, b: RecentEvent) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setEvents(filtered);

      // Generate chart data for 7d and 30d
      if (period !== "24h") {
        const days = period === "7d" ? 7 : 30;
        const interval = eachDayOfInterval({
          start: subDays(now, days - 1),
          end: now,
        });

        const dailyCounts = interval.map((day) => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          const count = filtered.filter((e: RecentEvent) => {
            const createdAt = new Date(e.created_at);
            return createdAt >= dayStart && createdAt <= dayEnd;
          }).length;

          return {
            date: format(day, period === "7d" ? "EEE" : "dd/MM", { locale: ptBR }),
            count,
          };
        });

        setChartData(dailyCounts);
      }
    } catch (err) {
      console.error("Error fetching recent events:", err);
    } finally {
      setLoading(false);
    }
  };

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Eventos Criados - {getPeriodLabel()}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Chart for 7d and 30d */}
            {period !== "24h" && chartData.length > 0 && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Distribuição por {period === "7d" ? "dia" : "dia"}
                </p>
                <div className="flex items-end gap-1 h-24">
                  {chartData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-primary/20 rounded-t transition-all hover:bg-primary/30"
                        style={{ 
                          height: `${(d.count / maxCount) * 100}%`,
                          minHeight: d.count > 0 ? "4px" : "0"
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground mt-1 truncate w-full text-center">
                        {d.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  Nenhum evento criado neste período
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {events.length} evento(s) criado(s)
                </p>
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-muted/50 border rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{event.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {event.owner?.full_name || "Organizador"}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>
                            Criado: {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                          <span>
                            Evento: {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RecentEventsModal;
