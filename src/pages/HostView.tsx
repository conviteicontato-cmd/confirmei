import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Lock, AlertTriangle, LogOut, RefreshCw, Plus } from "lucide-react";
import EventStatsCards from "@/components/event/EventStatsCards";
import GuestTableReadOnly from "@/components/event/GuestTableReadOnly";
import GuestTable from "@/components/event/GuestTable";
import AddGuestModal from "@/components/event/AddGuestModal";
import EditGuestModal from "@/components/event/EditGuestModal";
import type { Guest } from "@/components/event/EventManagement";

type PageState = "loading" | "not_found" | "no_password" | "login" | "authenticated";

const SESSION_KEY = "host_session";

interface HostSession {
  event_id: string;
  event_name: string;
  token: string;
  expires_at: number;
  allow_host_edit?: boolean;
}

interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  checkedIn: number;
  expectedPeople: number;
}

const getStoredSession = (eventId: string): HostSession | null => {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY}_${eventId}`);
    if (!raw) return null;
    const session: HostSession = JSON.parse(raw);
    if (Date.now() > session.expires_at) {
      localStorage.removeItem(`${SESSION_KEY}_${eventId}`);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

const HostView = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();
  const [state, setState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<HostSession | null>(null);
  const [allowHostEdit, setAllowHostEdit] = useState(false);

  // Data state
  const [guests, setGuests] = useState<Guest[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, pending: 0, checkedIn: 0, expectedPeople: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [eventName, setEventName] = useState("");

  // Edit mode state
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);

  useEffect(() => {
    if (!eventId) { setState("not_found"); return; }
    const stored = getStoredSession(eventId);
    if (stored) {
      setSession(stored);
      setEventName(stored.event_name);
      setAllowHostEdit(stored.allow_host_edit ?? false);
      setState("authenticated");
      return;
    }
    const check = async () => {
      const { data } = await supabase
        .from("public_events")
        .select("id, name")
        .eq("id", eventId)
        .maybeSingle();
      if (!data) { setState("not_found"); return; }
      setEventName(data.name);
      setState("login");
    };
    check();
  }, [eventId]);

  const fetchGuests = useCallback(async () => {
    if (!eventId) return;
    setDataLoading(true);
    try {
      const { data, error } = await supabase
        .from("guests")
        .select("id, name, status, max_adults, max_children, confirmed_adults, confirmed_children, checkin_done, checkin_at, qr_code, observations, companions, children, group_name")
        .eq("event_id", eventId)
        .order("name");

      if (error) throw error;
      const g = (data || []) as Guest[];
      setGuests(g);
      setStats({
        total: g.length,
        confirmed: g.filter(x => x.status === "confirmed").length,
        pending: g.filter(x => x.status === "pending").length,
        checkedIn: g.filter(x => x.checkin_done).length,
        expectedPeople: g.reduce((a, x) => a + (x.confirmed_adults || 0) + (x.confirmed_children || 0), 0),
      });
    } catch { /* silent */ }
    finally { setDataLoading(false); }
  }, [eventId]);

  // Also re-check allow_host_edit from DB on each refresh
  const refreshPermission = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data } = await supabase
        .from("events")
        .select("allow_host_edit")
        .eq("id", eventId)
        .single();
      if (data) {
        const val = (data as any).allow_host_edit ?? false;
        setAllowHostEdit(val);
      }
    } catch { /* silent */ }
  }, [eventId]);

  useEffect(() => {
    if (state === "authenticated") {
      fetchGuests();
      refreshPermission();
    }
  }, [state, fetchGuests, refreshPermission]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !eventId) return;
    setSubmitting(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-host-password", {
        body: { event_id: eventId, password: password.trim() },
      });
      if (fnError) { setError("Erro ao verificar senha. Tente novamente."); setSubmitting(false); return; }
      if (data?.error) {
        if (data.error.includes("não configurada")) setState("no_password");
        else setError(data.error);
        setSubmitting(false);
        return;
      }
      if (data?.success) {
        const s: HostSession = {
          event_id: data.event_id,
          event_name: data.event_name,
          token: data.token,
          expires_at: data.expires_at,
          allow_host_edit: data.allow_host_edit ?? false,
        };
        localStorage.setItem(`${SESSION_KEY}_${eventId}`, JSON.stringify(s));
        setSession(s);
        setEventName(data.event_name);
        setAllowHostEdit(data.allow_host_edit ?? false);
        setState("authenticated");
      }
    } catch { setError("Erro de conexão. Tente novamente."); }
    finally { setSubmitting(false); }
  };

  const handleLogout = () => {
    if (eventId) localStorage.removeItem(`${SESSION_KEY}_${eventId}`);
    setSession(null);
    setPassword("");
    setError("");
    setState("login");
  };

  const handleDeleteGuest = async (guestId: string) => {
    if (!eventId) return;
    try {
      const { error } = await supabase.from("guests").delete().eq("id", guestId);
      if (error) throw error;
      toast({ title: "Convidado removido" });
      fetchGuests();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Evento não encontrado</h1>
          <p className="text-muted-foreground text-sm">O link informado não corresponde a nenhum evento.</p>
        </div>
      </div>
    );
  }

  if (state === "no_password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <Lock className="h-12 w-12 text-warning mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Acesso não configurado</h1>
          <p className="text-muted-foreground text-sm">O organizador ainda não definiu uma senha para este acesso.</p>
        </div>
      </div>
    );
  }

  if (state === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <Lock className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-xl font-bold text-foreground">{eventName || "Visão do Anfitrião"}</h1>
            <p className="text-muted-foreground text-sm">Digite a senha para acompanhar as confirmações</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="host-password">Senha</Label>
              <Input
                id="host-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha do evento"
                autoFocus
                className="input-elegant"
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full btn-gold" disabled={submitting || !password.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Acessar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated dashboard
  if (state === "authenticated") {
    const progressPercent = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;

    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-foreground truncate">{eventName}</h2>
          <div className="flex items-center gap-2">
            {allowHostEdit && (
              <Button variant="outline" size="sm" onClick={() => setAddGuestOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Convidado
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { fetchGuests(); refreshPermission(); }} disabled={dataLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${dataLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>

        <div className="p-4 lg:p-8 max-w-6xl mx-auto">
          {dataLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
              <Skeleton className="h-4 rounded-full" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : (
            <>
              <EventStatsCards stats={stats} />

              <div className="mb-6 lg:mb-8 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso de confirmações</span>
                  <span className="font-medium text-foreground">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
              </div>

              {allowHostEdit && eventId ? (
                <GuestTable
                  guests={guests}
                  eventId={eventId}
                  onRefresh={fetchGuests}
                  onEdit={(guest) => setEditGuest(guest)}
                  webhookUrl={null}
                />
              ) : (
                <GuestTableReadOnly guests={guests} />
              )}
            </>
          )}
        </div>

        {allowHostEdit && eventId && (
          <>
            <AddGuestModal
              open={addGuestOpen}
              onOpenChange={setAddGuestOpen}
              eventId={eventId}
              onSuccess={fetchGuests}
              hostToken={session?.token}
            />
            {editGuest && (
              <EditGuestModal
                open={!!editGuest}
                onOpenChange={(open) => { if (!open) setEditGuest(null); }}
                guest={editGuest}
                eventId={eventId}
                onSuccess={fetchGuests}
              />
            )}
          </>
        )}
      </div>
    );
  }

  return null;
};

export default HostView;
