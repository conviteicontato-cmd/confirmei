import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Calendar, 
  Mail, 
  Clock, 
  Users, 
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Settings,
  Activity,
  FileText,
  QrCode,
  CreditCard,
  AlertTriangle,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import AdjustLimitModal from "./AdjustLimitModal";
import AdjustCreditsModal from "./AdjustCreditsModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
  roles: string[];
  event_limit: number | null;
  event_count: number;
  events_contracted?: number;
  events_used?: number;
  available_events?: number;
  credits_standard?: number;
  credits_qr?: number;
  is_super_admin?: boolean;
}

interface UserEvent {
  id: string;
  name: string;
  event_date: string;
  created_at: string;
  guest_count: number;
  checkin_count: number;
  credit_type?: string | null;
}

interface LimitHistory {
  id: string;
  previous_limit: number | null;
  new_limit: number | null;
  changed_by: string;
  changed_by_name?: string;
  reason: string | null;
  created_at: string;
}

interface UserActivity {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

interface CreditDetails {
  credits_standard: number;
  credits_qr: number;
  events_used: number;
  events_contracted: number;
  events_standard_count: number;
  events_qr_count: number;
}

interface CreditAuditEntry {
  id: string;
  created_at: string;
  details: {
    previous?: { credits_standard?: number; credits_qr?: number };
    new?: { credits_standard?: number; credits_qr?: number };
    reason?: string;
    reset_events?: boolean;
  } | null;
}

interface Props {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
  systemLimit: number;
}

const UserDetailModal = ({ user, open, onOpenChange, onUserUpdated, systemLimit }: Props) => {
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [limitHistory, setLimitHistory] = useState<LimitHistory[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [adjustLimitOpen, setAdjustLimitOpen] = useState(false);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && user) {
      fetchUserData();
    }
  }, [open, user]);

  const fetchUserData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch user events with guest counts
      const { data: eventsData } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_user_events", userId: user.user_id },
      });
      setEvents(eventsData?.events || []);

      // Fetch limit history
      const { data: historyData } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_user_limit_history", userId: user.user_id },
      });
      setLimitHistory(historyData?.history || []);

      // Fetch user activities
      const { data: activitiesData } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_audit_logs", filters: { user_id: user.user_id }, limit: 50 },
      });
      setActivities(activitiesData?.logs || []);
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventId) return;
    setDeletingEvent(true);

    try {
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "delete_event", eventId: deleteEventId },
      });

      if (error) throw error;

      toast({ title: "Evento excluído com sucesso" });
      fetchUserData();
      onUserUpdated();
    } catch (err) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o evento",
        variant: "destructive",
      });
    } finally {
      setDeletingEvent(false);
      setDeleteEventId(null);
    }
  };

  const getCreditsDisplay = () => {
    if (user?.is_super_admin || user?.roles?.includes("super_admin")) {
      return { label: "Ilimitado", contracted: "∞", used: "-", available: "∞" };
    }
    const contracted = user?.events_contracted || 0;
    const used = user?.events_used || 0;
    const available = Math.max(0, contracted - used);
    return { 
      label: `${used}/${contracted}`, 
      contracted: String(contracted), 
      used: String(used), 
      available: String(available) 
    };
  };

  const categorizeEvents = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      upcoming: events.filter((e) => new Date(e.event_date) >= today),
      past: events.filter((e) => new Date(e.event_date) < today),
    };
  };

  const { upcoming, past } = categorizeEvents();

  const totalGuests = events.reduce((acc, e) => acc + (e.guest_count || 0), 0);
  const totalCheckins = events.reduce((acc, e) => acc + (e.checkin_count || 0), 0);
  const averageAttendance = totalGuests > 0 ? Math.round((totalCheckins / totalGuests) * 100) : 0;

  const formatLimit = (limit: number | null) => {
    if (limit === null) return "Padrão do sistema";
    if (limit === -1) return "Ilimitado";
    return limit.toString();
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create_event: "Criou evento",
      update_event: "Atualizou evento",
      delete_event: "Excluiu evento",
      add_guest: "Adicionou convidado",
      update_guest: "Atualizou convidado",
      delete_guest: "Excluiu convidado",
      checkin_guest: "Realizou check-in",
    };
    return labels[action] || action;
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalhes do Usuário
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Info Header */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{user.full_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {user.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Clock className="h-4 w-4" />
                      Cadastro: {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant="outline"
                      className={
                        user.status === "approved"
                          ? "bg-primary/10 text-primary border-primary/30"
                          : user.status === "pending"
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                      }
                    >
                      {user.status === "approved" ? "Aprovado" : user.status === "pending" ? "Pendente" : "Rejeitado"}
                    </Badge>
                    {user.is_super_admin || user.roles?.includes("super_admin") ? (
                      <div className="text-sm">
                        <span className="font-medium text-primary">∞ Ilimitado</span>
                      </div>
                    ) : (
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="text-muted-foreground">Contratados: </span>
                          <span className="font-medium">{user.events_contracted || 0}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Utilizados: </span>
                          <span className="font-medium">{user.events_used || 0}</span>
                        </div>
                        <div className={`${(user.available_events || 0) === 0 ? "text-destructive" : "text-primary"}`}>
                          <span className="text-muted-foreground">Disponíveis: </span>
                          <span className="font-medium">{user.available_events || 0}</span>
                        </div>
                      </div>
                    )}
                    {!user.is_super_admin && !user.roles?.includes("super_admin") && (
                      <Button size="sm" variant="outline" onClick={() => setAdjustLimitOpen(true)}>
                        <Settings className="h-4 w-4 mr-1" />
                        Gerenciar créditos
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="events" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="events" className="flex-1">
                    <Calendar className="h-4 w-4 mr-1" />
                    Eventos ({events.length})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="flex-1">
                    <Clock className="h-4 w-4 mr-1" />
                    Histórico de Limites
                  </TabsTrigger>
                  <TabsTrigger value="activities" className="flex-1">
                    <Activity className="h-4 w-4 mr-1" />
                    Atividades
                  </TabsTrigger>
                </TabsList>

                {/* Events Tab */}
                <TabsContent value="events" className="space-y-4 mt-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">{totalGuests}</div>
                      <div className="text-xs text-muted-foreground">Total de Convidados</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">{totalCheckins}</div>
                      <div className="text-xs text-muted-foreground">Check-ins Realizados</div>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold">{averageAttendance}%</div>
                      <div className="text-xs text-muted-foreground">Taxa de Comparecimento</div>
                    </div>
                  </div>

                  {/* Upcoming Events */}
                  {upcoming.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Agendados ({upcoming.length})</h4>
                      <div className="space-y-2">
                        {upcoming.map((event) => (
                          <div key={event.id} className="flex items-center justify-between p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                            <div>
                              <div className="font-medium">{event.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })} • {event.guest_count} convidados
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteEventId(event.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past Events */}
                  {past.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Passados ({past.length})</h4>
                      <div className="space-y-2">
                        {past.map((event) => (
                          <div key={event.id} className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
                            <div>
                              <div className="font-medium text-muted-foreground">{event.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })} • {event.checkin_count}/{event.guest_count} check-ins
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setDeleteEventId(event.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {events.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum evento encontrado
                    </div>
                  )}
                </TabsContent>

                {/* Limit History Tab */}
                <TabsContent value="history" className="mt-4">
                  {limitHistory.length > 0 ? (
                    <div className="space-y-2">
                      {limitHistory.map((item) => (
                        <div key={item.id} className="p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-muted-foreground line-through mr-2">
                                {formatLimit(item.previous_limit)}
                              </span>
                              <span className="font-medium">→ {formatLimit(item.new_limit)}</span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </div>
                          </div>
                          {item.reason && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Motivo: {item.reason}
                            </div>
                          )}
                          {item.changed_by_name && (
                            <div className="text-xs text-muted-foreground">
                              Por: {item.changed_by_name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma alteração de limite registrada
                    </div>
                  )}
                </TabsContent>

                {/* Activities Tab */}
                <TabsContent value="activities" className="mt-4">
                  {activities.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {activities.map((activity) => (
                        <div key={activity.id} className="flex items-center justify-between p-2 border-b">
                          <div className="text-sm">
                            {getActionLabel(activity.action)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(activity.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma atividade registrada
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Limit Modal */}
      <AdjustLimitModal
        open={adjustLimitOpen}
        onOpenChange={setAdjustLimitOpen}
        user={user}
        systemLimit={systemLimit}
        onLimitUpdated={() => {
          fetchUserData();
          onUserUpdated();
        }}
      />

      {/* Delete Event Confirmation */}
      <AlertDialog open={!!deleteEventId} onOpenChange={() => setDeleteEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita e
              todos os convidados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletingEvent}
            >
              {deletingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default UserDetailModal;
