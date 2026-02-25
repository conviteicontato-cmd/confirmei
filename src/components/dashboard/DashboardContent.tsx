import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StatsCards from "./StatsCards";
import EventsList from "./EventsList";
import NewEventModal from "./NewEventModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DashboardContentProps {
  userId: string;
}

export interface Event {
  id: string;
  name: string;
  event_date: string;
  cover_image_url: string | null;
  short_message: string | null;
  primary_color: string;
  secondary_color: string;
}

export interface Stats {
  totalEvents: number;
  totalGuests: number;
  confirmedGuests: number;
  checkedIn: number;
}

const DashboardContent = ({ userId }: DashboardContentProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalEvents: 0,
    totalGuests: 0,
    confirmedGuests: 0,
    checkedIn: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (eventsError) throw eventsError;

      setEvents(eventsData || []);

      // Calculate stats
      if (eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map((e) => e.id);

        const { data: guestsData, error: guestsError } = await supabase
          .from("guests")
          .select("status, checkin_done")
          .in("event_id", eventIds);

        if (guestsError) throw guestsError;

        const totalGuests = guestsData?.length || 0;
        const confirmedGuests =
          guestsData?.filter((g) => g.status === "confirmed").length || 0;
        const checkedIn =
          guestsData?.filter((g) => g.checkin_done).length || 0;

        setStats({
          totalEvents: eventsData.length,
          totalGuests,
          confirmedGuests,
          checkedIn,
        });
      } else {
        setStats({
          totalEvents: 0,
          totalGuests: 0,
          confirmedGuests: 0,
          checkedIn: 0,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const handleEventCreated = () => {
    setShowNewEventModal(false);
    fetchData();
    toast({
      title: "Evento criado!",
      description: "Seu novo evento foi criado com sucesso.",
    });
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Painel
          </h1>
          <p className="text-muted-foreground">
            Visão geral dos seus eventos
          </p>
        </div>
        <Button
          onClick={() => setShowNewEventModal(true)}
          className="btn-gold rounded-full px-6"
        >
          <Plus className="h-5 w-5 mr-2" />
          Novo Evento
        </Button>
      </div>

      <StatsCards stats={stats} loading={loading} />

      <div className="mt-6 lg:mt-10">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h2 className="text-lg lg:text-xl font-display font-semibold text-foreground">
            Seus Eventos
          </h2>
          {events.length > 3 && (
            <button className="text-primary hover:underline text-sm font-medium">
              Ver todos
            </button>
          )}
        </div>
        <EventsList events={events} loading={loading} />
      </div>

      <NewEventModal
        open={showNewEventModal}
        onOpenChange={setShowNewEventModal}
        userId={userId}
        onEventCreated={handleEventCreated}
      />
    </div>
  );
};

export default DashboardContent;
