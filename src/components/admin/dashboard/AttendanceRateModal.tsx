import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart, Users, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventWithAttendance {
  id: string;
  name: string;
  event_date: string;
  owner?: {
    full_name: string;
  };
  total_guests: number;
  confirmed_guests: number;
  checkins: number;
  attendance_rate: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AttendanceRateModal = ({ open, onOpenChange }: Props) => {
  const [events, setEvents] = useState<EventWithAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallRate, setOverallRate] = useState(0);

  useEffect(() => {
    if (open) {
      fetchAttendanceData();
    }
  }, [open]);

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_events" },
      });

      if (error) throw error;

      // Get past events only
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const pastEvents = (eventsData.events || [])
        .filter((e: EventWithAttendance) => new Date(e.event_date) < today);

      if (pastEvents.length > 0) {
        const eventIds = pastEvents.map((e: EventWithAttendance) => e.id);
        const { data: guests } = await supabase
          .from("guests")
          .select("event_id, status, checkin_done")
          .in("event_id", eventIds);

        if (guests) {
          let totalConfirmed = 0;
          let totalCheckins = 0;

          const counts: Record<string, { total: number; confirmed: number; checkedIn: number }> = {};
          guests.forEach((g) => {
            if (!counts[g.event_id]) {
              counts[g.event_id] = { total: 0, confirmed: 0, checkedIn: 0 };
            }
            counts[g.event_id].total++;
            if (g.status === "confirmed") {
              counts[g.event_id].confirmed++;
              totalConfirmed++;
            }
            if (g.checkin_done) {
              counts[g.event_id].checkedIn++;
              totalCheckins++;
            }
          });

          const eventsWithAttendance = pastEvents.map((e: EventWithAttendance) => {
            const c = counts[e.id] || { total: 0, confirmed: 0, checkedIn: 0 };
            return {
              ...e,
              total_guests: c.total,
              confirmed_guests: c.confirmed,
              checkins: c.checkedIn,
              attendance_rate: c.confirmed > 0 
                ? Math.round((c.checkedIn / c.confirmed) * 100) 
                : 0,
            };
          });

          // Sort by attendance rate descending
          eventsWithAttendance.sort((a: EventWithAttendance, b: EventWithAttendance) => 
            b.attendance_rate - a.attendance_rate
          );

          setEvents(eventsWithAttendance);
          setOverallRate(totalConfirmed > 0 
            ? Math.round((totalCheckins / totalConfirmed) * 100) 
            : 0
          );
        }
      } else {
        setEvents([]);
        setOverallRate(0);
      }
    } catch (err) {
      console.error("Error fetching attendance data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (rate >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-primary" />
            Taxa de Comparecimento
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <BarChart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Nenhum evento finalizado para análise
            </p>
          </div>
        ) : (
          <>
            {/* Overall stat */}
            <div className={`p-4 rounded-lg border ${getAttendanceColor(overallRate)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Taxa Geral de Comparecimento</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Baseado em {events.length} eventos finalizados
                  </p>
                </div>
                <div className="text-3xl font-bold">
                  {overallRate}%
                </div>
              </div>
            </div>

            {/* Events comparison */}
            <div className="space-y-2 mt-4">
              <p className="text-sm font-medium text-muted-foreground">
                Comparação por Evento
              </p>
              
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-3 bg-muted/50 border rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{event.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event.checkins}/{event.confirmed_guests} check-ins
                        </span>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={getAttendanceColor(event.attendance_rate)}
                    >
                      {event.attendance_rate}%
                    </Badge>
                  </div>
                  
                  {/* Mini progress bar */}
                  <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        event.attendance_rate >= 80 ? "bg-green-500" :
                        event.attendance_rate >= 50 ? "bg-amber-500" :
                        "bg-red-500"
                      }`}
                      style={{ width: `${event.attendance_rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceRateModal;
