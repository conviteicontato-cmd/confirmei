import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NewEventModal from "./NewEventModal";
import {
  Search,
  Bell,
  Plus,
  Calendar,
  Users,
  Check,
  UserCheck,
  MapPin,
  QrCode,
  CheckSquare,
  Share2,
  ChevronRight,
  Minus,
} from "lucide-react";
import { format, differenceInCalendarDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardContentProps {
  userId: string;
}

interface EventRow {
  id: string;
  name: string;
  event_date: string;
  cover_image_url: string | null;
  primary_color: string;
  secondary_color: string;
  checkin_mode: string | null;
}

interface EventWithCounts extends EventRow {
  total: number;
  confirmed: number;
  checkedIn: number;
  past: boolean;
}

type EventTab = "proximos" | "passados" | "todos";
type CreditReqType = "qr" | "noqr";

interface CreditRequest {
  type: CreditReqType;
  qty: number;
  status: "Pendente" | "Aprovado";
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const coverStyle = (ev: EventRow): React.CSSProperties =>
  ev.cover_image_url
    ? { background: `url(${ev.cover_image_url}) center/cover` }
    : {
        background: `linear-gradient(150deg, ${ev.primary_color || "#4c0c14"}, ${
          ev.secondary_color || "#a83f57"
        })`,
      };

const DashboardContent = ({ userId }: DashboardContentProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [events, setEvents] = useState<EventWithCounts[]>([]);
  const [profileName, setProfileName] = useState("");
  const [creditsQr, setCreditsQr] = useState(0);
  const [creditsStandard, setCreditsStandard] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<EventTab>("proximos");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState(false);

  const [reqType, setReqType] = useState<CreditReqType>("qr");
  const [reqQty, setReqQty] = useState(1);
  const [requests, setRequests] = useState<CreditRequest[]>([]);

  const fetchData = async () => {
    try {
      const [{ data: profile }, { data: eventsData, error: eventsError }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, credits_standard, credits_qr")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("events")
          .select("id, name, event_date, cover_image_url, primary_color, secondary_color, checkin_mode")
          .eq("user_id", userId)
          .order("event_date", { ascending: true }),
      ]);

      if (eventsError) throw eventsError;

      setProfileName(profile?.full_name || profile?.email || "");
      setCreditsStandard(profile?.credits_standard ?? 0);
      setCreditsQr(profile?.credits_qr ?? 0);

      const list = eventsData || [];
      const today = startOfDay(new Date());

      let guestsByEvent: Record<string, { total: number; confirmed: number; checkedIn: number }> = {};
      if (list.length > 0) {
        const ids = list.map((e) => e.id);
        const { data: guestsData, error: guestsError } = await supabase
          .from("guests")
          .select("event_id, status, checkin_done")
          .in("event_id", ids);
        if (guestsError) throw guestsError;
        for (const g of guestsData || []) {
          const acc = (guestsByEvent[g.event_id] ??= { total: 0, confirmed: 0, checkedIn: 0 });
          acc.total += 1;
          if (g.status === "confirmed") acc.confirmed += 1;
          if (g.checkin_done) acc.checkedIn += 1;
        }
      }

      const withCounts: EventWithCounts[] = list.map((e) => {
        const c = guestsByEvent[e.id] || { total: 0, confirmed: 0, checkedIn: 0 };
        return {
          ...e,
          ...c,
          past: isBefore(startOfDay(new Date(e.event_date)), today),
        };
      });

      setEvents(withCounts);
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
    if (userId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const open = () => setShowNewEvent(true);
    window.addEventListener("open-new-event", open);
    return () => window.removeEventListener("open-new-event", open);
  }, []);

  const upcoming = useMemo(() => events.filter((e) => !e.past), [events]);
  const spotlight = upcoming[0];

  const stats = useMemo(() => {
    const totalGuests = events.reduce((s, e) => s + e.total, 0);
    const confirmed = events.reduce((s, e) => s + e.confirmed, 0);
    const checkedIn = events.reduce((s, e) => s + e.checkedIn, 0);
    const rate = totalGuests > 0 ? Math.round((confirmed / totalGuests) * 100) : 0;
    return { active: upcoming.length, totalGuests, confirmed, checkedIn, rate };
  }, [events, upcoming]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (tab === "todos" ? true : tab === "passados" ? e.past : !e.past) &&
        (!q || e.name.toLowerCase().includes(q))
    );
  }, [events, tab, query]);

  const handleEventCreated = () => {
    setShowNewEvent(false);
    fetchData();
    toast({ title: "Evento criado!", description: "Seu novo evento foi criado com sucesso." });
  };

  const scrollToEvents = () => {
    const el = document.getElementById("po-events");
    if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 80, behavior: "smooth" });
  };

  const submitRequest = () => {
    setRequests((prev) => [{ type: reqType, qty: reqQty, status: "Pendente" }, ...prev]);
    setReqQty(1);
    toast({
      title: "Solicitação enviada",
      description: "Seu pedido será analisado pela administração do Confirmei.",
    });
  };

  const notifs = useMemo(() => {
    const items: { title: string; time: string; color: string }[] = [];
    if (stats.confirmed > 0)
      items.push({ title: `${stats.confirmed} confirmações registradas`, time: "atualizado agora", color: "#2f8f63" });
    if (spotlight)
      items.push({ title: `${spotlight.name} está chegando`, time: "próximo evento", color: "#7a1b2a" });
    if (creditsQr + creditsStandard === 0)
      items.push({ title: "Você está sem créditos disponíveis", time: "ação necessária", color: "#d99a2e" });
    return items;
  }, [stats.confirmed, spotlight, creditsQr, creditsStandard]);

  const tabs: { id: EventTab; label: string }[] = [
    { id: "proximos", label: "Próximos" },
    { id: "passados", label: "Passados" },
    { id: "todos", label: "Todos" },
  ];

  const seg = (active: boolean) =>
    active
      ? "bg-[#4c0c14] text-white"
      : "bg-transparent text-[#9a8478]";

  return (
    <div className="font-grotesk text-[#3a0a10] bg-[#f4eee5] min-h-screen flex flex-col">
      {/* ============ TOP BAR ============ */}
      <header className="flex items-center gap-5 px-4 md:px-10 py-4 md:py-[22px] border-b border-[#e6dccf] bg-[#f4eee5]/70 backdrop-blur-[6px] sticky top-0 z-[5]">
        <div className="flex-1 min-w-0">
          <h1 className="font-serif font-semibold text-[23px] md:text-[30px] leading-[1.05] text-[#3a0a10]">
            {greeting()}{profileName ? `, ${profileName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-[13.5px] text-[#9a8478] mt-[2px]">
            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })} · você tem{" "}
            <span className="text-[#3a0a10] font-semibold">{stats.active} eventos ativos</span> e{" "}
            <span className="text-[#d44e7d] font-semibold">{stats.confirmed} confirmações</span>
          </p>
        </div>

        <div className="flex items-center gap-[11px] flex-none">
          <div className="hidden lg:flex items-center gap-[9px] bg-white border border-[#e6dccf] rounded-[11px] px-[14px] py-[9px] w-[230px] text-[#9a8478]">
            <Search className="w-[17px] h-[17px]" strokeWidth={1.9} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evento…"
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-[13.5px] text-[#3a0a10]"
            />
          </div>

          <div className="relative flex-none">
            <button
              onClick={() => {
                setNotifOpen((o) => !o);
                setNotifRead(true);
              }}
              className="relative w-[42px] h-[42px] rounded-[11px] border border-[#e6dccf] bg-white flex items-center justify-center text-[#5e3b32] hover:bg-[#fbf7f1] transition-colors"
            >
              <Bell className="w-[19px] h-[19px]" strokeWidth={1.8} />
              {!notifRead && notifs.length > 0 && (
                <span className="absolute top-[9px] right-[10px] w-2 h-2 rounded-full bg-[#ef86aa] shadow-[0_0_0_2px_#fff]" />
              )}
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                <div className="absolute top-[52px] right-0 w-[336px] bg-white border border-[#e6dccf] rounded-[14px] shadow-[0_22px_54px_-18px_rgba(46,12,16,.45)] z-[31] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-[14px] border-b border-[#f0e6da]">
                    <span className="text-sm font-semibold text-[#3a0a10]">Notificações</span>
                    <span
                      onClick={() => setNotifRead(true)}
                      className="text-xs font-semibold text-[#7a1b2a] cursor-pointer hover:underline"
                    >
                      Marcar como lidas
                    </span>
                  </div>
                  {notifs.length > 0 ? (
                    notifs.map((n, i) => (
                      <div key={i} className="flex gap-[11px] px-4 py-[13px] border-b border-[#f5efe6] hover:bg-[#fbf7f1]">
                        <span className="w-[9px] h-[9px] rounded-full flex-none mt-[5px]" style={{ background: n.color }} />
                        <div className="min-w-0">
                          <p className="text-[13px] text-[#3a0a10] leading-[1.35]">{n.title}</p>
                          <p className="text-[11.5px] text-[#9a8478] mt-[2px]">{n.time}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12.5px] text-[#9a8478] px-4 py-[18px] text-center">Tudo em dia.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowNewEvent(true)}
            className="hidden lg:flex items-center gap-2 bg-[#4c0c14] text-white rounded-[11px] px-5 py-[11px] text-sm font-semibold hover:bg-[#5e1019] transition-colors shadow-[0_6px_16px_-6px_rgba(76,12,20,.6)]"
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={2.2} />
            Novo Evento
          </button>
        </div>
      </header>

      <div className="px-4 md:px-10 pt-[30px] pb-24 md:pb-12 max-w-[1240px] w-full mx-auto">
        {/* ============ NEXT EVENT SPOTLIGHT ============ */}
        {spotlight && (
          <section className="flex flex-col md:flex-row bg-white border border-[#ece2d5] rounded-[22px] overflow-hidden shadow-[0_18px_40px_-24px_rgba(76,12,20,.35)] mb-[26px] animate-float-in">
            <div
              className="w-full md:w-[300px] flex-none relative p-[26px] flex flex-col justify-between gap-6 min-h-[180px]"
              style={coverStyle(spotlight)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-black/40 md:bg-none" />
              <div className="relative inline-flex items-center gap-[7px] self-start bg-[#f4eee5]/[0.16] border border-[#f4eee5]/[0.25] rounded-full px-3 py-[6px]">
                <span className="w-[7px] h-[7px] rounded-full bg-[#ef86aa] animate-pulse-dot" />
                <span className="text-[10.5px] font-semibold tracking-[1.2px] uppercase text-[#f4eee5]">
                  Próximo evento
                </span>
              </div>
              <div className="relative">
                <p className="text-[12px] tracking-[1.5px] uppercase text-[#f4eee5]/60 mb-[6px]">
                  {spotlight.checkin_mode === "qr" ? "Check-in por QR Code" : "Evento"}
                </p>
                <h2 className="font-serif font-semibold text-[34px] leading-[1.04] text-white">
                  {spotlight.name}
                </h2>
              </div>
            </div>

            <div className="flex-1 min-w-0 p-[26px] md:px-[30px] flex flex-col justify-between gap-[18px]">
              <div className="flex items-start justify-between gap-5">
                <div className="flex gap-[26px] flex-wrap">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.8px] uppercase text-[#b3a194] mb-[5px]">Data</p>
                    <div className="flex items-center gap-2 text-[#3a0a10]">
                      <Calendar className="w-[17px] h-[17px] text-[#7a1b2a]" strokeWidth={1.9} />
                      <span className="text-[14.5px] font-semibold">
                        {format(new Date(spotlight.event_date), "EEE, d 'de' MMMM", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.8px] uppercase text-[#b3a194] mb-[5px]">Convidados</p>
                    <div className="flex items-center gap-2 text-[#3a0a10]">
                      <Users className="w-[17px] h-[17px] text-[#7a1b2a]" strokeWidth={1.9} />
                      <span className="text-[14.5px] font-semibold">{spotlight.total} convidados</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-none">
                  <p className="font-serif font-semibold text-[40px] leading-[0.9] text-[#4c0c14]">
                    {Math.max(0, differenceInCalendarDays(new Date(spotlight.event_date), new Date()))}
                  </p>
                  <p className="text-[11px] font-semibold tracking-[0.8px] uppercase text-[#b3a194]">dias restantes</p>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[13px] text-[#9a8478]">Confirmações</span>
                  <span className="text-[13px] text-[#3a0a10]">
                    <b className="font-bold text-[15px]">{spotlight.confirmed}</b> de {spotlight.total} convidados ·{" "}
                    <span className="text-[#2f8f63] font-semibold">
                      {spotlight.total > 0 ? Math.round((spotlight.confirmed / spotlight.total) * 100) : 0}%
                    </span>
                  </span>
                </div>
                <div className="h-[9px] rounded-full bg-[#efe4d7] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#4c0c14] to-[#a83f57]"
                    style={{ width: `${spotlight.total > 0 ? Math.round((spotlight.confirmed / spotlight.total) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-[10px]">
                <button
                  onClick={() => navigate(`/event/${spotlight.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#4c0c14] text-white rounded-[11px] py-3 text-sm font-semibold hover:bg-[#5e1019] transition-colors"
                >
                  <Users className="w-[17px] h-[17px]" strokeWidth={1.9} />
                  Gerenciar convidados
                </button>
                <button
                  onClick={() => navigate(`/event/${spotlight.id}`)}
                  className="flex items-center justify-center gap-2 bg-white text-[#4c0c14] border border-[#e3d6c8] rounded-[11px] py-3 px-[18px] text-sm font-semibold hover:bg-[#fbf7f1] transition-colors"
                >
                  <QrCode className="w-[17px] h-[17px]" strokeWidth={1.9} />
                  Check-in
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/event/${spotlight.id}`);
                    toast({ title: "Link copiado", description: "Link do convite copiado para a área de transferência." });
                  }}
                  className="w-[46px] flex-none flex items-center justify-center bg-white text-[#4c0c14] border border-[#e3d6c8] rounded-[11px] hover:bg-[#fbf7f1] transition-colors"
                >
                  <Share2 className="w-[17px] h-[17px]" strokeWidth={1.9} />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ============ STATS ============ */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-[30px]">
          {[
            { icon: Calendar, value: stats.active, label: "Eventos ativos", iconBg: "bg-[#f4e7e0]", iconColor: "text-[#7a1b2a]", badge: null as string | null },
            { icon: Users, value: stats.totalGuests, label: "Convidados cadastrados", iconBg: "bg-[#f4e7e0]", iconColor: "text-[#7a1b2a]", badge: null },
            { icon: Check, value: stats.confirmed, label: "Confirmados", iconBg: "bg-[#e6f1ea]", iconColor: "text-[#2f8f63]", badge: `${stats.rate}%` },
            { icon: UserCheck, value: stats.checkedIn, label: "Check-ins realizados", iconBg: "bg-[#f6ecda]", iconColor: "text-[#b07d22]", badge: null },
          ].map((card, i) => (
            <div
              key={i}
              onClick={scrollToEvents}
              className="bg-white border border-[#ece2d5] rounded-2xl px-5 py-[18px] cursor-pointer transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_26px_-18px_rgba(76,12,20,.4)]"
            >
              <div className="flex items-center justify-between mb-[14px]">
                <div className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center ${card.iconBg} ${card.iconColor}`}>
                  <card.icon className="w-[19px] h-[19px]" strokeWidth={1.8} />
                </div>
                {card.badge ? (
                  <span className="text-[11.5px] font-semibold text-[#2f8f63] bg-[#e6f1ea] px-2 py-[3px] rounded-full">
                    {card.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#cdbcae]" strokeWidth={2} />
                )}
              </div>
              <p className="font-bold text-[28px] text-[#3a0a10] leading-none">{loading ? "—" : card.value}</p>
              <p className="text-[13px] text-[#9a8478] mt-[3px]">{card.label}</p>
            </div>
          ))}
        </section>

        {/* ============ CRÉDITOS ============ */}
        <section className="mb-[30px]">
          <h2 className="font-serif font-semibold text-[25px] text-[#3a0a10] mb-[18px]">Seus créditos</h2>
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-[18px] items-start">
            <div className="bg-white border border-[#ece2d5] rounded-[18px] px-6 py-[22px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px] mb-5">
                <div className="bg-[#faf6f0] border border-[#efe6db] rounded-[14px] px-[18px] py-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[30px] text-[#3a0a10] leading-none">{creditsQr}</p>
                    <p className="text-[12.5px] text-[#9a8478] mt-1">Com QR Code</p>
                  </div>
                  <div className="w-[42px] h-[42px] rounded-[11px] bg-[#f4e7e0] text-[#7a1b2a] flex items-center justify-center flex-none">
                    <QrCode className="w-[21px] h-[21px]" strokeWidth={1.8} />
                  </div>
                </div>
                <div className="bg-[#faf6f0] border border-[#efe6db] rounded-[14px] px-[18px] py-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[30px] text-[#3a0a10] leading-none">{creditsStandard}</p>
                    <p className="text-[12.5px] text-[#9a8478] mt-1">Sem QR Code</p>
                  </div>
                  <div className="w-[42px] h-[42px] rounded-[11px] bg-[#e6f1ea] text-[#2f8f63] flex items-center justify-center flex-none">
                    <CheckSquare className="w-[21px] h-[21px]" strokeWidth={1.9} />
                  </div>
                </div>
              </div>

              <div className="h-px bg-[#f0e6da] mb-[18px]" />

              <p className="text-[13.5px] font-semibold text-[#3a0a10] mb-[13px]">Solicitar mais créditos</p>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-[6px] bg-[#faf6f0] border border-[#e6dccf] rounded-[11px] p-1">
                  <button
                    onClick={() => setReqType("qr")}
                    className={`border-none cursor-pointer text-[13px] font-semibold px-[14px] py-2 rounded-[9px] ${seg(reqType === "qr")}`}
                  >
                    Com QR
                  </button>
                  <button
                    onClick={() => setReqType("noqr")}
                    className={`border-none cursor-pointer text-[13px] font-semibold px-[14px] py-2 rounded-[9px] ${seg(reqType === "noqr")}`}
                  >
                    Sem QR
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setReqQty((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-full border-2 border-[#4c0c14] bg-white text-[#4c0c14] flex items-center justify-center"
                  >
                    <Minus className="w-[15px] h-[15px]" strokeWidth={2.4} />
                  </button>
                  <span className="font-bold text-[20px] text-[#3a0a10] w-[26px] text-center">{reqQty}</span>
                  <button
                    onClick={() => setReqQty((q) => q + 1)}
                    className="w-9 h-9 rounded-full border-2 border-[#4c0c14] bg-[#4c0c14] text-white flex items-center justify-center"
                  >
                    <Plus className="w-[15px] h-[15px]" strokeWidth={2.4} />
                  </button>
                </div>
                <button
                  onClick={submitRequest}
                  className="flex-1 min-w-[150px] flex items-center justify-center gap-2 bg-[#4c0c14] text-white rounded-[11px] px-[18px] py-[11px] text-[13.5px] font-semibold hover:bg-[#5e1019] transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Solicitar
                </button>
              </div>
              <p className="text-[12px] text-[#b3a194] mt-3">
                As solicitações são aprovadas pela administração do Confirmei.
              </p>
            </div>

            <div className="bg-white border border-[#ece2d5] rounded-[18px] overflow-hidden">
              <div className="px-5 pt-[18px] pb-[14px]">
                <p className="text-[13.5px] font-semibold text-[#3a0a10]">Pedidos recentes</p>
              </div>
              <div className="border-t border-[#efe6db]">
                {requests.length > 0 ? (
                  requests.map((p, i) => {
                    const isQr = p.type === "qr";
                    const isApproved = p.status === "Aprovado";
                    return (
                      <div key={i} className="flex items-center gap-[11px] px-5 py-[13px] border-b border-[#f3ece2]">
                        <span
                          className="text-[11.5px] font-semibold px-[10px] py-1 rounded-full whitespace-nowrap"
                          style={{
                            color: isQr ? "#7a1b2a" : "#2f8f63",
                            background: isQr ? "#f4e7e0" : "#e6f1ea",
                          }}
                        >
                          {isQr ? "Com QR Code" : "Sem QR Code"}
                        </span>
                        <span className="text-[13.5px] font-bold text-[#3a0a10]">+{p.qty}</span>
                        <div className="flex-1" />
                        <span
                          className="text-[11.5px] font-semibold px-[10px] py-1 rounded-full whitespace-nowrap"
                          style={{
                            color: isApproved ? "#2f8f63" : "#b07d22",
                            background: isApproved ? "#e6f1ea" : "#f6ecda",
                          }}
                        >
                          {p.status}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[12.5px] text-[#9a8478] px-5 py-4">Nenhum pedido ainda.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ============ EVENTS ============ */}
        <section id="po-events">
          <div className="flex items-center justify-between gap-4 mb-[18px] flex-wrap">
            <h2 className="font-serif font-semibold text-[25px] text-[#3a0a10]">Seus eventos</h2>
            <div className="flex items-center gap-[6px] bg-white border border-[#e6dccf] rounded-[12px] p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`border-none cursor-pointer text-[13.5px] font-semibold px-4 py-[7px] rounded-[9px] ${seg(tab === t.id)}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="bg-white border border-[#ece2d5] rounded-[18px] p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-[#cdbcae] mb-4" />
              <p className="text-[#9a8478]">Nenhum evento encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
              {filteredEvents.map((ev) => {
                const pct = ev.total > 0 ? Math.round((ev.confirmed / ev.total) * 100) : 0;
                const high = pct >= 70;
                const status = ev.past ? "Encerrado" : high ? "No prazo" : "Aguardando";
                const statusColors = ev.past
                  ? { color: "#8a7468", bg: "#efe7de", dot: "#b3a194" }
                  : high
                  ? { color: "#2f8f63", bg: "#e6f1ea", dot: "#2f8f63" }
                  : { color: "#b07d22", bg: "#f6ecda", dot: "#d99a2e" };
                const barColor = ev.past
                  ? "#9a8478"
                  : high
                  ? "linear-gradient(90deg,#2f8f63,#46a878)"
                  : "linear-gradient(90deg,#4c0c14,#a83f57)";
                return (
                  <div
                    key={ev.id}
                    onClick={() => navigate(`/event/${ev.id}`)}
                    className="bg-white border border-[#ece2d5] rounded-[18px] overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_20px_38px_-24px_rgba(76,12,20,.45)]"
                  >
                    <div className="h-[104px] relative" style={coverStyle(ev)}>
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
                      <span className="absolute top-3 left-3 text-[10.5px] font-semibold tracking-[0.8px] uppercase text-white bg-black/20 border border-white/25 px-[9px] py-1 rounded-full backdrop-blur-[3px]">
                        {ev.checkin_mode === "qr" ? "QR Code" : "Lista"}
                      </span>
                      <span
                        className="absolute top-[11px] right-3 inline-flex items-center gap-[5px] text-[11px] font-semibold px-[9px] py-1 rounded-full"
                        style={{ color: statusColors.color, background: statusColors.bg }}
                      >
                        <span className="w-[6px] h-[6px] rounded-full" style={{ background: statusColors.dot }} />
                        {status}
                      </span>
                      <h3 className="absolute left-[14px] bottom-[11px] font-serif font-semibold text-[21px] text-white leading-[1.05] drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
                        {ev.name}
                      </h3>
                    </div>
                    <div className="px-4 pt-[15px] pb-[17px]">
                      <div className="flex items-center gap-[14px] mb-[13px]">
                        <div className="flex items-center gap-[6px] text-[#9a8478] text-[12.5px]">
                          <Calendar className="w-[15px] h-[15px]" strokeWidth={1.9} />
                          {format(new Date(ev.event_date), "d MMM", { locale: ptBR })}
                        </div>
                        <div className="flex items-center gap-[6px] text-[#9a8478] text-[12.5px]">
                          <Users className="w-[15px] h-[15px]" strokeWidth={1.9} />
                          {ev.total}
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between mb-[7px]">
                        <span className="text-[12px] text-[#9a8478]">Confirmados</span>
                        <span className="text-[12.5px] text-[#3a0a10] font-semibold">
                          {ev.confirmed}/{ev.total} · {pct}%
                        </span>
                      </div>
                      <div className="h-[7px] rounded-full bg-[#efe4d7] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <NewEventModal
        open={showNewEvent}
        onOpenChange={setShowNewEvent}
        userId={userId}
        onEventCreated={handleEventCreated}
      />
    </div>
  );
};

export default DashboardContent;
