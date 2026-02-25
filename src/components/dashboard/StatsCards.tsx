import { Calendar, Users, CheckCircle, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Stats } from "./DashboardContent";

interface StatsCardsProps {
  stats: Stats;
  loading: boolean;
}

const StatsCards = ({ stats, loading }: StatsCardsProps) => {
  const cards = [
    {
      label: "Total de Eventos",
      value: stats.totalEvents,
      icon: Calendar,
      variant: "default" as const,
    },
    {
      label: "Convidados Cadastrados",
      sublabel: "Todos os eventos",
      value: stats.totalGuests,
      icon: Users,
      variant: "default" as const,
    },
    {
      label: "Confirmados",
      value: stats.confirmedGuests,
      icon: CheckCircle,
      variant: "success" as const,
    },
    {
      label: "Check-ins Realizados",
      value: stats.checkedIn,
      icon: UserCheck,
      variant: "warning" as const,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`stat-card ${
            card.variant === "success"
              ? "stat-card-success"
              : card.variant === "warning"
              ? "stat-card-warning"
              : ""
          }`}
        >
          <div>
            <p className="text-xs lg:text-sm text-muted-foreground mb-1">{card.label}</p>
            {card.sublabel && (
              <p className="hidden lg:block text-xs text-muted-foreground/70 mb-1">
                {card.sublabel}
              </p>
            )}
            <p className="text-xl lg:text-2xl font-bold text-foreground">
              {card.value > 0 ? card.value : "—"}
            </p>
          </div>
          <div
            className={`p-2 lg:p-2.5 rounded-lg ${
              card.variant === "success"
                ? "bg-success/10 text-success"
                : card.variant === "warning"
                ? "bg-warning/10 text-warning"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <card.icon className="h-4 w-4 lg:h-5 lg:w-5" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
