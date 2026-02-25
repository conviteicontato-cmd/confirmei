import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { 
  Users, 
  Calendar, 
  UserCheck, 
  Clock, 
  TrendingUp,
  CheckCircle,
  Loader2,
  UserX,
  AlertTriangle,
  BarChart
} from "lucide-react";
import StatCard from "./dashboard/StatCard";
import PendingUsersModal from "./dashboard/PendingUsersModal";
import ApprovedUsersModal from "./dashboard/ApprovedUsersModal";
import RejectedUsersModal from "./dashboard/RejectedUsersModal";
import UpcomingEventsModal from "./dashboard/UpcomingEventsModal";
import PastEventsModal from "./dashboard/PastEventsModal";
import TodayCheckinsModal from "./dashboard/TodayCheckinsModal";
import RecentEventsModal from "./dashboard/RecentEventsModal";
import UsersAtLimitModal from "./dashboard/UsersAtLimitModal";
import AttendanceRateModal from "./dashboard/AttendanceRateModal";

interface DashboardStats {
  users: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    atLimit: number;
  };
  events: {
    total: number;
    upcoming: number;
    past: number;
    last24h: number;
    last7d: number;
    last30d: number;
  };
  checkinsToday: number;
  attendanceRate: number;
}

type AdminTab = "dashboard" | "users" | "events" | "audit" | "settings";

interface AdminDashboardProps {
  onTabChange?: (tab: AdminTab) => void;
}

const AdminDashboard = ({ onTabChange }: AdminDashboardProps) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { settings } = useSystemSettings();
  
  // Modal states
  const [pendingUsersOpen, setPendingUsersOpen] = useState(false);
  const [approvedUsersOpen, setApprovedUsersOpen] = useState(false);
  const [rejectedUsersOpen, setRejectedUsersOpen] = useState(false);
  const [upcomingEventsOpen, setUpcomingEventsOpen] = useState(false);
  const [pastEventsOpen, setPastEventsOpen] = useState(false);
  const [todayCheckinsOpen, setTodayCheckinsOpen] = useState(false);
  const [recentEventsOpen, setRecentEventsOpen] = useState(false);
  const [recentEventsPeriod, setRecentEventsPeriod] = useState<"24h" | "7d" | "30d">("24h");
  const [usersAtLimitOpen, setUsersAtLimitOpen] = useState(false);
  const [attendanceRateOpen, setAttendanceRateOpen] = useState(false);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_dashboard_stats" },
      });

      if (error) throw error;
      
      // Add users at limit count
      const { data: usersData } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_users" },
      });
      
      const usersAtLimit = (usersData?.users || []).filter((user: { event_limit: number | null; event_count: number }) => {
        const effectiveLimit = user.event_limit === -1 ? Infinity : (user.event_limit ?? settings.max_events_per_user);
        return user.event_count >= effectiveLimit && effectiveLimit !== Infinity;
      }).length;

      // Calculate attendance rate
      const { data: guests } = await supabase
        .from("guests")
        .select("status, checkin_done");
      
      let confirmedCount = 0;
      let checkinCount = 0;
      (guests || []).forEach((g) => {
        if (g.status === "confirmed") confirmedCount++;
        if (g.checkin_done) checkinCount++;
      });
      const attendanceRate = confirmedCount > 0 ? Math.round((checkinCount / confirmedCount) * 100) : 0;

      setStats({
        ...data,
        users: {
          ...data.users,
          atLimit: usersAtLimit,
        },
        attendanceRate,
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchStats();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
          Dashboard Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">
          Visão geral do sistema em tempo real • Clique nos cards para ver detalhes
        </p>
      </div>

      {/* User Stats */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Usuários</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total de Usuários"
            value={stats?.users.total || 0}
            icon={Users}
            onClick={() => onTabChange?.("users")}
          />

          <StatCard
            title="Pendentes"
            value={stats?.users.pending || 0}
            icon={Clock}
            iconColor="text-amber-500"
            borderColor="border-amber-500/50"
            valueColor="text-amber-500"
            badge={stats?.users.pending || 0}
            badgeColor="warning"
            onClick={() => setPendingUsersOpen(true)}
          />

          <StatCard
            title="Aprovados"
            value={stats?.users.approved || 0}
            icon={UserCheck}
            iconColor="text-green-500"
            borderColor="border-green-500/50"
            valueColor="text-green-500"
            onClick={() => setApprovedUsersOpen(true)}
          />

          <StatCard
            title="Rejeitados"
            value={stats?.users.rejected || 0}
            icon={UserX}
            iconColor="text-destructive"
            borderColor="border-destructive/50"
            valueColor="text-destructive"
            onClick={() => setRejectedUsersOpen(true)}
          />

          <StatCard
            title="No Limite"
            value={stats?.users.atLimit || 0}
            icon={AlertTriangle}
            iconColor="text-destructive"
            borderColor="border-destructive/50"
            valueColor="text-destructive"
            badge={stats?.users.atLimit || 0}
            badgeColor="destructive"
            onClick={() => setUsersAtLimitOpen(true)}
          />
        </div>
      </div>

      {/* Event Stats */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Eventos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total de Eventos"
            value={stats?.events.total || 0}
            icon={Calendar}
            onClick={() => onTabChange?.("events")}
          />

          <StatCard
            title="Próximos"
            value={stats?.events.upcoming || 0}
            icon={TrendingUp}
            iconColor="text-primary"
            valueColor="text-primary"
            onClick={() => setUpcomingEventsOpen(true)}
          />

          <StatCard
            title="Finalizados"
            value={stats?.events.past || 0}
            icon={CheckCircle}
            onClick={() => setPastEventsOpen(true)}
          />

          <StatCard
            title="Check-ins Hoje"
            value={stats?.checkinsToday || 0}
            icon={UserCheck}
            iconColor="text-green-500"
            valueColor="text-green-500"
            onClick={() => setTodayCheckinsOpen(true)}
          />

          <StatCard
            title="Taxa de Comparecimento"
            value={`${stats?.attendanceRate || 0}%`}
            icon={BarChart}
            iconColor="text-primary"
            valueColor="text-primary"
            description="Check-ins / Confirmados"
            onClick={() => setAttendanceRateOpen(true)}
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Atividade Recente (Eventos Criados)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card 
            className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50"
            onClick={() => {
              setRecentEventsPeriod("24h");
              setRecentEventsOpen(true);
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Últimas 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.events.last24h || 0}</div>
              <p className="text-xs text-muted-foreground">eventos criados</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50"
            onClick={() => {
              setRecentEventsPeriod("7d");
              setRecentEventsOpen(true);
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Últimos 7 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.events.last7d || 0}</div>
              <p className="text-xs text-muted-foreground">eventos criados</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50"
            onClick={() => {
              setRecentEventsPeriod("30d");
              setRecentEventsOpen(true);
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Últimos 30 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.events.last30d || 0}</div>
              <p className="text-xs text-muted-foreground">eventos criados</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modals */}
      <PendingUsersModal
        open={pendingUsersOpen}
        onOpenChange={setPendingUsersOpen}
        onUserUpdated={handleRefresh}
      />

      <ApprovedUsersModal
        open={approvedUsersOpen}
        onOpenChange={setApprovedUsersOpen}
      />

      <RejectedUsersModal
        open={rejectedUsersOpen}
        onOpenChange={setRejectedUsersOpen}
        onUserUpdated={handleRefresh}
      />

      <UpcomingEventsModal
        open={upcomingEventsOpen}
        onOpenChange={setUpcomingEventsOpen}
      />

      <PastEventsModal
        open={pastEventsOpen}
        onOpenChange={setPastEventsOpen}
        onEventsUpdated={handleRefresh}
      />

      <TodayCheckinsModal
        open={todayCheckinsOpen}
        onOpenChange={setTodayCheckinsOpen}
      />

      <RecentEventsModal
        open={recentEventsOpen}
        onOpenChange={setRecentEventsOpen}
        period={recentEventsPeriod}
      />

      <UsersAtLimitModal
        open={usersAtLimitOpen}
        onOpenChange={setUsersAtLimitOpen}
        systemLimit={settings.max_events_per_user}
        onUserUpdated={handleRefresh}
      />

      <AttendanceRateModal
        open={attendanceRateOpen}
        onOpenChange={setAttendanceRateOpen}
      />
    </div>
  );
};

export default AdminDashboard;
