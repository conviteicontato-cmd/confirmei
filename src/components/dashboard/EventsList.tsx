import { useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Event } from "./DashboardContent";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventsListProps {
  events: Event[];
  loading: boolean;
}

const EventsList = ({ events, loading }: EventsListProps) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card-elegant p-8 lg:p-12 text-center">
        <Calendar className="h-10 w-10 lg:h-12 lg:w-12 mx-auto text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Nenhum evento ainda
        </h3>
        <p className="text-muted-foreground">
          Crie seu primeiro evento clicando em "Novo Evento"
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
      {events.slice(0, 6).map((event) => (
        <EventCard
          key={event.id}
          event={event}
          onClick={() => navigate(`/event/${event.id}`)}
        />
      ))}
    </div>
  );
};

interface EventCardProps {
  event: Event;
  onClick: () => void;
}

const EventCard = ({ event, onClick }: EventCardProps) => {
  const formattedDate = format(new Date(event.event_date), "d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });

  return (
    <div
      onClick={onClick}
      className="card-elegant overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300"
    >
      <div
        className="h-32 sm:h-40 relative overflow-hidden"
        style={{
          background: event.cover_image_url
            ? `url(${event.cover_image_url}) center/cover`
            : `linear-gradient(135deg, ${event.primary_color} 0%, ${event.secondary_color} 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4">
          <h3 className="text-white font-display font-semibold text-base sm:text-lg line-clamp-2">
            {event.name}
          </h3>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span className="text-sm">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
};

export default EventsList;
