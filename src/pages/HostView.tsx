import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Loader2,
  Lock,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Plus,
  LogIn,
  Info,
  Search,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Check,
  Heart,
} from "lucide-react";
import GuestTableReadOnly from "@/components/event/GuestTableReadOnly";
import GuestTable from "@/components/event/GuestTable";
import AddGuestModal from "@/components/event/AddGuestModal";
import EditGuestModal from "@/components/event/EditGuestModal";
import type { Guest } from "@/components/event/EventManagement";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PageState = "loading" | "not_found" | "no_password" | "login" | "authenticated";
type StatusFilter = "all" | "confirmed" | "pending" | "declined";

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
  declined: number;
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

const InfoScreen = ({
  icon: Icon,
  iconColor,
  title,
  message,
}: {
  icon: typeof Lock;
  iconColor: string;
  title: string;
  message: string;
}) => (
  <div className="min-h-screen flex items-center justify-center bg-[#f4eee5] font-grotesk text-[#3a0a10] p-6">
    <div className="w-full max-w-sm text-center space-y-3">
      <Icon className={`h-12 w-12 mx-auto ${iconColor}`} />
      <h1 className="font-serif font-semibold text-2xl text-[#3a0a10]">{title}</h1>
      <p className="text-[#9a8478] text-sm">{message}</p>
    </div>
  </div>
);

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
  const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, pending: 0, declined: 0, checkedIn: 0, expectedPeople: 0 });
  const [dataLoading, setDataLoading] = useState(true);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState<string | null>(null);

  // UI state
  const [filter, setFilter] = useState<StatusFilter>("all");
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
        .select("id, name, event_date")
        .eq("id", eventId)
        .maybeSingle();
      if (!data) { setState("not_found"); return; }
      setEventName(data.name);
      setEventDate((data as any).event_date ?? null);
      setState("login");
    };
    check();
  }, [eventId]);

  const fetchEventMeta = useCallback(async () => {
    if (!eventId) return;
    const { data } = await supabase
      .from("public_events")
      .select("name, event_date")
      .eq("id", eventId)
      .maybeSingle();
    if (data) {
      setEventName(data.name);
      setEventDate((data as any).event_date ?? null);
    }
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
        confirmed: g.filter((x) => x.status === "confirmed").length,
        pending: g.filter((x) => x.status === "pending").length,
        declined: g.filter((x) => x.status === "declined").length,
        checkedIn: g.filter((x) => x.checkin_done).length,
        expectedPeople: g.reduce((a, x) => a + (x.confirmed_adults || 0) + (x.confirmed_children || 0), 0),
      });
    } catch { /* silent */ }
    finally { setDataLoading(false); }
  }, [eventId]);

  const refreshPermission = useCallback(async () => {
    if (!eventId) return;
    try {
      const { data } = await supabase
        .from("events")
        .select("allow_host_edit")
        .eq("id", eventId)
        .single();
      if (data) setAllowHostEdit((data as any).allow_host_edit ?? false);
    } catch { /* silent */ }
  }, [eventId]);

  useEffect(() => {
    if (state === "authenticated") {
      fetchGuests();
      refreshPermission();
      fetchEventMeta();
    }
  }, [state, fetchGuests, refreshPermission, fetchEventMeta]);

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

  const filteredGuests = useMemo(
    () => (filter === "all" ? guests : guests.filter((g) => g.status === filter)),
    [guests, filter]
  );

  const eventInitials = useMemo(() => {
    const parts = (eventName || "Evento").trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "E").concat(parts[1]?.[0] || "").toUpperCase();
  }, [eventName]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4eee5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#4c0c14]" />
      </div>
    );
  }

  if (state === "not_found") {
    return (
      <InfoScreen
        icon={AlertTriangle}
        iconColor="text-[#b3242f]"
        title="Evento não encontrado"
        message="O link informado não corresponde a nenhum evento."
      />
    );
  }

  if (state === "no_password") {
    return (
      <InfoScreen
        icon={Lock}
        iconColor="text-[#b07d22]"
        title="Acesso não configurado"
        message="O organizador ainda não definiu uma senha para este acesso."
      />
    );
  }

  // ============ PASSWORD GATE ============
  if (state === "login") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 font-grotesk text-[#3a0a10] bg-[radial-gradient(120%_80%_at_50%_-10%,#f3ebdf_0%,#f4eee5_55%,#e7ddcf_100%)]">
        <div className="flex items-center gap-[11px] mb-[26px]">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-[#4c0c14] flex items-center justify-center flex-none">
            <span className="font-serif font-bold text-[23px] text-[#f4eee5] leading-none">C</span>
          </div>
          <span className="font-serif font-semibold text-[25px] text-[#3a0a10]">Confirmei</span>
        </div>

        <div className="w-full max-w-[408px] bg-white border border-[#ece2d5] rounded-[24px] px-[34px] pt-[34px] pb-[30px] shadow-[0_34px_74px_-34px_rgba(76,12,20,.5)] text-center">
          <div className="w-[58px] h-[58px] rounded-[16px] bg-[#f4e7e0] flex items-center justify-center mx-auto mb-[18px]">
            <Lock className="w-[26px] h-[26px] text-[#7a1b2a]" strokeWidth={1.9} />
          </div>
          <p className="text-[11px] font-bold tracking-[1px] uppercase text-[#a8917f]">Área do anfitrião</p>
          <h1 className="font-serif font-semibold text-[28px] text-[#3a0a10] leading-[1.1] mt-[6px]">
            {eventName || "Evento"}
          </h1>
          <p className="text-[13.5px] text-[#9a8478] mt-2 leading-[1.5]">
            Digite a senha de acesso compartilhada pelo organizador para entrar.
          </p>

          <form onSubmit={handleLogin}>
            <label className="text-[12px] font-semibold text-[#7a6258] block text-left mt-[22px] mb-2">
              Senha de acesso
            </label>
            <div
              className="flex items-center gap-[10px] bg-[#faf6f0] rounded-[13px] px-[15px] py-[13px] border-[1.5px]"
              style={{ borderColor: error ? "#d88" : "#e6dccf" }}
            >
              <Lock className="w-[18px] h-[18px] text-[#b3a194] flex-none" strokeWidth={1.8} />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••"
                autoFocus
                className="flex-1 border-none outline-none bg-transparent text-[15.5px] tracking-[2px] text-[#3a0a10]"
              />
            </div>
            {error && (
              <p className="text-[12.5px] font-semibold text-[#c0392b] mt-[9px] text-left">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !password.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#4c0c14] text-white rounded-[13px] py-[14px] mt-[18px] text-[15px] font-semibold hover:bg-[#5e1019] transition-colors disabled:opacity-60 shadow-[0_12px_28px_-12px_rgba(76,12,20,.6)]"
            >
              {submitting ? <Loader2 className="h-[17px] w-[17px] animate-spin" /> : <LogIn className="h-[17px] w-[17px]" strokeWidth={2} />}
              Entrar
            </button>
          </form>
        </div>
        <p className="text-[11.5px] text-[#a8917f] mt-[18px]">
          Acesso protegido · somente quem tem a senha pode visualizar
        </p>
      </div>
    );
  }

  // ============ AUTHENTICATED APP ============
  const statCards = [
    { value: stats.total, label: "Convidados", bg: "bg-[#f4e7e0]", color: "text-[#7a1b2a]", icon: Users },
    { value: stats.confirmed, label: "Confirmados", bg: "bg-[#e6f1ea]", color: "text-[#2f8f63]", icon: CheckCircle2 },
    { value: stats.pending, label: "Pendentes", bg: "bg-[#f6ecda]", color: "text-[#b07d22]", icon: Clock },
    { value: stats.declined, label: "Recusados", bg: "bg-[#f7e3e6]", color: "text-[#b3242f]", icon: XCircle },
  ];

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: stats.total },
    { key: "confirmed", label: "Confirmados", count: stats.confirmed },
    { key: "pending", label: "Pendentes", count: stats.pending },
    { key: "declined", label: "Recusados", count: stats.declined },
  ];

  const permChips = allowHostEdit
    ? ["Adicionar", "Editar", "Ver confirmados", "Ver pendentes", "Ver recusados"]
    : ["Ver confirmados", "Ver pendentes", "Ver recusados"];

  return (
    <div className="min-h-screen w-full bg-[#f4eee5] font-grotesk text-[#3a0a10] flex flex-col">
      {/* top bar */}
      <header className="flex items-center gap-4 px-4 md:px-10 py-4 border-b border-[#e6dccf] bg-[#f4eee5]/[0.85] backdrop-blur-[6px] sticky top-0 z-[5]">
        <div className="flex items-center gap-[11px] flex-1 min-w-0">
          <div className="w-8 h-8 rounded-[9px] bg-[#4c0c14] flex items-center justify-center flex-none">
            <span className="font-serif font-bold text-[21px] text-[#f4eee5] leading-none">C</span>
          </div>
          <span className="font-serif font-semibold text-[23px] text-[#3a0a10] hidden sm:inline">Confirmei</span>
          <span className="text-[11px] font-bold tracking-[1px] uppercase text-[#7a1b2a] bg-[#f4e7e0] px-[11px] py-[5px] rounded-[7px] sm:ml-1">
            Área do anfitrião
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchGuests(); refreshPermission(); }}
            disabled={dataLoading}
            className="flex items-center gap-1 text-[13px] font-semibold text-[#5e3b32] bg-white border border-[#e6dccf] rounded-[10px] px-3 py-2 hover:bg-[#fbf7f1] transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${dataLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-[13px] font-semibold text-[#5e3b32] bg-white border border-[#e6dccf] rounded-[10px] px-3 py-2 hover:bg-[#fbf7f1] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-[1060px] mx-auto px-4 md:px-10 pt-[30px] pb-14">
        {/* event hero */}
        <div className="relative rounded-[20px] overflow-hidden bg-[linear-gradient(150deg,#4c0c14_0%,#7a1b2a_55%,#a83f57_100%)] px-[30px] py-7 mb-6 shadow-[0_20px_48px_-28px_rgba(76,12,20,.6)]">
          <div className="flex items-center gap-[9px] mb-[10px]">
            <Heart className="w-[18px] h-[18px] text-[#ef86aa] fill-[#ef86aa]" />
            <span className="text-[11.5px] font-semibold tracking-[1px] uppercase text-[#f0c3d2]">
              Você é anfitrião deste evento
            </span>
          </div>
          <h1 className="font-serif font-semibold text-[34px] text-white leading-[1.05]">{eventName}</h1>
          {eventDate && (
            <p className="text-[14px] text-[#f4eee5]/80 mt-[5px]">
              {format(new Date(eventDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-[18px]">
            {permChips.map((label) => (
              <span
                key={label}
                className="flex items-center gap-[6px] text-[12px] font-semibold text-white bg-white/[0.12] border border-white/[0.18] px-3 py-[6px] rounded-full"
              >
                <Check className="w-[13px] h-[13px] text-[#9ee6bd]" strokeWidth={2.4} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* stats */}
        {dataLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px] mb-[22px]">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[78px] rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px] mb-[22px]">
            {statCards.map((s) => (
              <div key={s.label} className="bg-white border border-[#ece2d5] rounded-2xl px-5 py-[18px] flex items-center gap-[14px]">
                <span className={`w-[42px] h-[42px] rounded-[11px] flex-none flex items-center justify-center ${s.bg} ${s.color}`}>
                  <s.icon className="w-[21px] h-[21px]" strokeWidth={1.9} />
                </span>
                <div>
                  <p className="font-bold text-[25px] text-[#3a0a10] leading-none">{s.value}</p>
                  <p className="text-[12.5px] text-[#9a8478] mt-[2px]">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* list header */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-[14px]">
          <div>
            <h2 className="font-serif font-semibold text-[23px] text-[#3a0a10] leading-[1.1]">Lista de convidados</h2>
            <p className="text-[13px] text-[#9a8478] mt-[2px]">
              Você pode ver e gerenciar os convidados conforme as permissões concedidas.
            </p>
          </div>
          {allowHostEdit && (
            <button
              onClick={() => setAddGuestOpen(true)}
              className="flex items-center gap-2 bg-[#4c0c14] text-white rounded-[11px] px-[18px] py-[11px] text-[13.5px] font-semibold hover:bg-[#5e1019] transition-colors shadow-[0_6px_16px_-6px_rgba(76,12,20,.6)]"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Adicionar convidado
            </button>
          )}
        </div>

        {/* filters */}
        <div className="flex gap-2 flex-wrap mb-4">
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-[7px] rounded-full px-[15px] py-2 text-[13px] font-semibold border transition-colors ${
                  active
                    ? "bg-[#4c0c14] text-white border-[#4c0c14]"
                    : "bg-white text-[#5e3b32] border-[#e6dccf] hover:bg-[#fbf7f1]"
                }`}
              >
                {f.label}
                <span className="text-[11.5px] opacity-70">{f.count}</span>
              </button>
            );
          })}
        </div>

        {/* table */}
        {dataLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : filteredGuests.length === 0 ? (
          <div className="bg-white border border-[#ece2d5] rounded-2xl flex items-center justify-center gap-[9px] py-[34px] px-[22px] text-[#9a8478]">
            <Search className="w-[18px] h-[18px] text-[#b3a194]" strokeWidth={1.9} />
            <span className="text-[13.5px]">Nenhum convidado neste filtro.</span>
          </div>
        ) : allowHostEdit && eventId ? (
          <GuestTable
            guests={filteredGuests}
            eventId={eventId}
            onRefresh={fetchGuests}
            onEdit={(guest) => setEditGuest(guest)}
            webhookUrl={null}
          />
        ) : (
          <GuestTableReadOnly guests={filteredGuests} />
        )}

        {/* locked notice */}
        <div className="flex items-start gap-3 bg-[#faf6f0] border border-[#ece2d5] rounded-[14px] px-[18px] py-[15px] mt-4">
          <Lock className="w-[18px] h-[18px] text-[#b07d22] flex-none mt-[1px]" strokeWidth={1.8} />
          <p className="text-[12.5px] text-[#7a6258] leading-[1.5]">
            Seu acesso é definido pelo organizador. Configurações do evento, mensagens, check-in e integrações ficam disponíveis apenas para a organizadora do evento.
          </p>
        </div>
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
};

export default HostView;
