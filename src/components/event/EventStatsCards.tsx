import { Users, Check, Clock, UserPlus, CheckSquare } from "lucide-react";

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
    { label: "Convidados", value: stats.total, icon: Users, chipBg: "#f4e7e0", chipColor: "#7a1b2a" },
    { label: "Confirmados", value: stats.confirmed, icon: Check, chipBg: "#e6f1ea", chipColor: "#2f8f63" },
    { label: "Pendentes", value: stats.pending, icon: Clock, chipBg: "#f6ecda", chipColor: "#b07d22" },
    { label: "Pessoas esperadas", value: stats.expectedPeople, icon: UserPlus, chipBg: "#f4e7e0", chipColor: "#7a1b2a" },
    { label: "Check-ins", value: stats.checkedIn, icon: CheckSquare, chipBg: "#fbe7ee", chipColor: "#d44e7d" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[14px] mb-[22px]">
      {statsCards.map((stat) => (
        <div
          key={stat.label}
          className="bg-white border border-[#ece2d5] rounded-[15px] p-[15px_17px]"
        >
          <div
            className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center mb-[11px]"
            style={{ background: stat.chipBg, color: stat.chipColor }}
          >
            <stat.icon className="w-[17px] h-[17px]" strokeWidth={1.85} />
          </div>
          <p className="font-grotesk font-bold text-2xl text-[#3a0a10] leading-none">{stat.value}</p>
          <p className="text-xs text-[#9a8478] mt-[3px]">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};

export default EventStatsCards;
