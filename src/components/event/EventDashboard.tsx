import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw,
  ArrowLeft,
  Users,
  UserCheck,
  Clock,
  CheckCircle,
  Baby,
  UserPlus,
  TrendingUp,
  BarChart3,
  Inbox,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface EventDashboardProps {
  eventId: string;
  eventName?: string;
  onBack?: () => void;
}

interface GuestRow {
  id: string;
  status: string | null;
  confirmed_adults: number | null;
  confirmed_children: number | null;
  checkin_done: boolean | null;
  checkin_at: string | null;
}

interface DashboardStats {
  totalGuests: number;
  confirmed: number;
  pending: number;
  declined: number;
  expectedPeople: number;
  expectedAdults: number;
  expectedChildren: number;
  presentPeople: number;
  presentAdults: number;
  presentChildren: number;
  onTheWayPeople: number;
  onTheWayAdults: number;
  onTheWayChildren: number;
  confirmationRate: number;
  checkinRate: number;
  arrivalsByHour: { hour: string; count: number }[];
}

const emptyStats: DashboardStats = {
  totalGuests: 0,
  confirmed: 0,
  pending: 0,
  declined: 0,
  expectedPeople: 0,
  expectedAdults: 0,
  expectedChildren: 0,
  presentPeople: 0,
  presentAdults: 0,
  presentChildren: 0,
  onTheWayPeople: 0,
  onTheWayAdults: 0,
  onTheWayChildren: 0,
  confirmationRate: 0,
  checkinRate: 0,
  arrivalsByHour: [],
};

// Chart colors from the design system (HSL tokens)
const COLOR_PRIMARY = "hsl(350 75% 17%)"; // wine
const COLOR_SECONDARY = "hsl(340 78% 73%)"; // pink
const COLOR_SUCCESS = "hsl(145 40% 45%)";
const COLOR_WARNING = "hsl(38 60% 55%)";
const COLOR_DESTRUCTIVE = "hsl(0 55% 55%)";
const COLOR_MUTED = "hsl(340 20% 80%)";

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
      {label && <p className="font-medium text-foreground mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-muted-foreground flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color || entry.payload?.fill }}
          />
          {entry.name}: <span className="font-semibold text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

const KpiCard = ({
  label,
  value,
  suffix,
  icon: Icon,
  bgColor,
  iconBgColor,
  iconColor,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: React.ElementType;
  bgColor: string;
  iconBgColor: string;
  iconColor: string;
}) => (
  <div className={`rounded-xl p-4 ${bgColor} flex items-center justify-between`}>
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-display font-bold text-foreground">
        {value}
        {suffix && <span className="text-base font-semibold ml-0.5">{suffix}</span>}
      </p>
    </div>
    <div className={`w-10 h-10 rounded-lg ${iconBgColor} flex items-center justify-center`}>
      <Icon className={`h-5 w-5 ${iconColor}`} />
    </div>
  </div>
);

const EventDashboard = ({ eventId, eventName, onBack }: EventDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from("guests")
        .select("id, status, confirmed_adults, confirmed_children, checkin_done, checkin_at")
        .eq("event_id", eventId);

      if (error || !data) {
        setStats(emptyStats);
        setLoading(false);
        setRefreshing(false);
        setLastUpdated(new Date());
        return;
      }

      const guests = data as GuestRow[];
      const s: DashboardStats = { ...emptyStats, arrivalsByHour: [] };
      const hourMap = new Map<string, number>();

      s.totalGuests = guests.length;

      for (const g of guests) {
        const adults = g.confirmed_adults ?? 0;
        const children = g.confirmed_children ?? 0;

        if (g.status === "confirmed") {
          s.confirmed++;
          s.expectedAdults += adults;
          s.expectedChildren += children;

          if (g.checkin_done) {
            s.presentAdults += adults;
            s.presentChildren += children;
            if (g.checkin_at) {
              const d = new Date(g.checkin_at);
              const hh = String(d.getHours()).padStart(2, "0");
              const hourKey = `${hh}:00`;
              hourMap.set(hourKey, (hourMap.get(hourKey) ?? 0) + adults + children);
            }
          } else {
            s.onTheWayAdults += adults;
            s.onTheWayChildren += children;
          }
        } else if (g.status === "declined" || g.status === "canceled") {
          s.declined++;
        } else {
          s.pending++;
        }
      }

      s.expectedPeople = s.expectedAdults + s.expectedChildren;
      s.presentPeople = s.presentAdults + s.presentChildren;
      s.onTheWayPeople = s.onTheWayAdults + s.onTheWayChildren;
      s.confirmationRate = s.totalGuests > 0 ? Math.round((s.confirmed / s.totalGuests) * 100) : 0;
      s.checkinRate = s.expectedPeople > 0 ? Math.round((s.presentPeople / s.expectedPeople) * 100) : 0;

      s.arrivalsByHour = Array.from(hourMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([hour, count]) => ({ hour, count }));

      setStats(s);
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
    },
    [eventId]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatTime = (d: Date | null) =>
    d
      ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "--:--:--";

  const formatDateTime = (d: Date | null) =>
    d
      ? d.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--";

  if (loading) {
    return (
      <div className="p-4 lg:p-8">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  const hasData = stats.totalGuests > 0;

  const statusData = [
    { name: "Confirmados", value: stats.confirmed, fill: COLOR_SUCCESS },
    { name: "Pendentes", value: stats.pending, fill: COLOR_WARNING },
    { name: "Recusados", value: stats.declined, fill: COLOR_DESTRUCTIVE },
  ].filter((d) => d.value > 0);

  const presenceData = [
    { name: "Chegaram", value: stats.presentPeople, fill: COLOR_PRIMARY },
    { name: "A caminho", value: stats.onTheWayPeople, fill: COLOR_SECONDARY },
  ].filter((d) => d.value > 0);

  const adultsChildrenData = [
    {
      name: "Adultos",
      Chegaram: stats.presentAdults,
      "A caminho": stats.onTheWayAdults,
    },
    {
      name: "Crianças",
      Chegaram: stats.presentChildren,
      "A caminho": stats.onTheWayChildren,
    },
  ];

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
              </span>
              Dashboard ao Vivo
            </h1>
            {eventName && <p className="text-sm text-muted-foreground">{eventName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Atualizado às {formatTime(lastUpdated)}
          </span>
          <Button onClick={() => fetchData(true)} disabled={refreshing} className="btn-gold rounded-full">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="ml-2">Atualizar</span>
          </Button>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center text-center py-24">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-1">
            Nenhum dado disponível
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Assim que os convidados forem adicionados e começarem a confirmar presença, as
            estatísticas aparecerão aqui em tempo real.
          </p>
        </div>
      ) : (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
            <KpiCard
              label="Pessoas no Evento"
              value={stats.presentPeople}
              icon={UserCheck}
              bgColor="bg-success-muted"
              iconBgColor="bg-success/20"
              iconColor="text-success"
            />
            <KpiCard
              label="A Caminho"
              value={stats.onTheWayPeople}
              icon={Clock}
              bgColor="bg-warning-muted"
              iconBgColor="bg-warning/20"
              iconColor="text-warning"
            />
            <KpiCard
              label="Taxa de Check-in"
              value={stats.checkinRate}
              suffix="%"
              icon={TrendingUp}
              bgColor="bg-accent/40"
              iconBgColor="bg-primary/15"
              iconColor="text-primary"
            />
            <KpiCard
              label="Taxa de Confirmação"
              value={stats.confirmationRate}
              suffix="%"
              icon={CheckCircle}
              bgColor="bg-accent/40"
              iconBgColor="bg-secondary/30"
              iconColor="text-secondary"
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
            <KpiCard
              label="Adultos no Evento"
              value={stats.presentAdults}
              icon={Users}
              bgColor="bg-muted/50"
              iconBgColor="bg-muted"
              iconColor="text-muted-foreground"
            />
            <KpiCard
              label="Crianças no Evento"
              value={stats.presentChildren}
              icon={Baby}
              bgColor="bg-muted/50"
              iconBgColor="bg-muted"
              iconColor="text-muted-foreground"
            />
            <KpiCard
              label="Total Adultos Esperados"
              value={stats.expectedAdults}
              icon={UserPlus}
              bgColor="bg-muted/50"
              iconBgColor="bg-muted"
              iconColor="text-muted-foreground"
            />
            <KpiCard
              label="Total Crianças Esperadas"
              value={stats.expectedChildren}
              icon={Baby}
              bgColor="bg-muted/50"
              iconBgColor="bg-muted"
              iconColor="text-muted-foreground"
            />
          </div>

          {/* Donut charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="card-elegant p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">
                Status das Confirmações
              </h3>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-16">Sem dados</p>
              )}
            </div>

            <div className="card-elegant p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">
                Presença em Tempo Real
              </h3>
              {presenceData.length > 0 ? (
                <div className="relative">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={presenceData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {presenceData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -mt-7">
                    <span className="text-3xl font-display font-bold text-primary">
                      {stats.presentPeople}
                    </span>
                    <span className="text-xs text-muted-foreground">presentes</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-16">Sem dados</p>
              )}
            </div>
          </div>

          {/* Bar charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="card-elegant p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">
                Adultos vs. Crianças
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={adultsChildrenData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(340 20% 88%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(340 40% 90% / 0.3)" }} />
                  <Legend />
                  <Bar dataKey="Chegaram" fill={COLOR_PRIMARY} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="A caminho" fill={COLOR_SECONDARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card-elegant p-5">
              <h3 className="text-sm font-display font-semibold text-foreground mb-4">
                Chegadas por Hora
              </h3>
              {stats.arrivalsByHour.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.arrivalsByHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(340 20% 88%)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(340 40% 90% / 0.3)" }} />
                    <Bar dataKey="count" name="Chegadas" fill={COLOR_SECONDARY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma chegada registrada ainda.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Buffet summary */}
          <div className="rounded-xl bg-primary text-primary-foreground p-6">
            <h3 className="text-lg font-display font-bold mb-4">Resumo para o Buffet</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-3xl font-display font-bold">{stats.presentPeople}</p>
                <p className="text-sm opacity-80">Pessoas no evento agora</p>
              </div>
              <div>
                <p className="text-3xl font-display font-bold">{stats.onTheWayPeople}</p>
                <p className="text-sm opacity-80">Ainda chegando</p>
              </div>
              <div>
                <p className="text-3xl font-display font-bold">{stats.expectedPeople}</p>
                <p className="text-sm opacity-80">Total esperado</p>
              </div>
              <div>
                <p className="text-3xl font-display font-bold">{stats.presentChildren}</p>
                <p className="text-sm opacity-80">Crianças presentes</p>
              </div>
            </div>
            <p className="text-xs opacity-70 mt-5">
              Última atualização: {formatDateTime(lastUpdated)}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default EventDashboard;
