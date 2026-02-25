import { Users, UserCheck, Clock, CheckCircle } from "lucide-react";

interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  checkedIn: number;
  expectedPeople: number;
}

interface EventStatsCardsProps {
  stats: Stats;
}

const EventStatsCards = ({ stats }: EventStatsCardsProps) => {
  const statsCards = [
    { 
      label: "Total", 
      value: stats.total, 
      icon: Users,
      bgColor: "bg-muted/50",
      iconBgColor: "bg-muted",
      iconColor: "text-muted-foreground"
    },
    { 
      label: "Confirmados", 
      value: stats.confirmed, 
      icon: UserCheck,
      bgColor: "bg-success-muted",
      iconBgColor: "bg-success/20",
      iconColor: "text-success"
    },
    { 
      label: "Pendentes", 
      value: stats.pending, 
      icon: Clock,
      bgColor: "bg-muted/50",
      iconBgColor: "bg-muted",
      iconColor: "text-muted-foreground"
    },
    { 
      label: "Pessoas Esperadas", 
      value: stats.expectedPeople, 
      icon: Users,
      bgColor: "bg-warning-muted",
      iconBgColor: "bg-warning/20",
      iconColor: "text-warning"
    },
    { 
      label: "Check-ins", 
      value: stats.checkedIn, 
      icon: CheckCircle,
      bgColor: "bg-destructive/10",
      iconBgColor: "bg-destructive/20",
      iconColor: "text-destructive"
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-6 lg:mb-8">
      {statsCards.map((stat) => (
        <div 
          key={stat.label} 
          className={`rounded-xl p-3 lg:p-4 ${stat.bgColor} flex items-center justify-between`}
        >
          <div>
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">
              {stat.value}
            </p>
          </div>
          <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg ${stat.iconBgColor} flex items-center justify-center`}>
            <stat.icon className={`h-4 w-4 lg:h-5 lg:w-5 ${stat.iconColor}`} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default EventStatsCards;
