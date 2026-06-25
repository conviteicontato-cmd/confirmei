import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Search,
  ArrowLeft,
  Minus,
  Plus,
  Heart,
  Clock,
  CheckCircle2,
  Share2,
  XCircle,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeCanvas } from "qrcode.react";

interface EventData {
  id: string;
  name: string;
  event_date: string;
  short_message: string | null;
  cover_image_url: string | null;
  confirmation_active: boolean | null;
  confirmation_deadline: string | null;
  auto_block: boolean | null;
}

interface GuestData {
  id: string;
  name: string;
  group_name: string | null;
  max_adults: number | null;
  max_children: number | null;
  confirmed_adults: number | null;
  confirmed_children: number | null;
  status: string | null;
  qr_code: string | null;
  confirmed_at: string | null;
  whatsapp: string | null;
}

interface Participant {
  id: string;
  name: string | null;
  type: string;
  age: string | null;
  qr_code: string;
  checked_in_at: string | null;
}

type PageState = "search" | "confirm" | "whatsapp" | "success" | "declined";

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const PublicEvent = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GuestData[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestData | null>(null);
  const [pageState, setPageState] = useState<PageState>("search");
  const [saving, setSaving] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Confirmation form state
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<string[]>([]);
  const [companionNames, setCompanionNames] = useState<string[]>([]);
  const [childrenNames, setChildrenNames] = useState<string[]>([]);
  const [whatsappInput, setWhatsappInput] = useState("");
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const { data, error } = await supabase
          .from("public_events")
          .select(
            "id, name, event_date, short_message, cover_image_url, confirmation_active, confirmation_deadline, auto_block"
          )
          .eq("id", eventId)
          .maybeSingle();
        if (error) throw error;
        setEvent(data as EventData);
      } catch (error: any) {
        console.error("Error fetching event:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    const searchGuests = async () => {
      if (!eventId || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("guests")
          .select(
            "id, name, group_name, max_adults, max_children, confirmed_adults, confirmed_children, status, qr_code, confirmed_at, whatsapp"
          )
          .eq("event_id", eventId)
          .ilike("name", `%${searchQuery}%`)
          .limit(10);
        if (error) throw error;
        setSearchResults((data as GuestData[]) || []);
      } catch (error: any) {
        console.error("Error searching guests:", error);
      }
    };
    const debounce = setTimeout(searchGuests, 300);
    return () => clearTimeout(debounce);
  }, [eventId, searchQuery]);

  const isConfirmationsClosed = event
    ? event.confirmation_active === false ||
      (event.auto_block === true &&
        event.confirmation_deadline &&
        new Date() > new Date(event.confirmation_deadline))
    : false;

  const fetchParticipants = async (guestId: string) => {
    const { data } = await supabase
      .from("guest_participants")
      .select("id, name, type, age, qr_code, checked_in_at")
      .eq("guest_id", guestId)
      .order("type");
    setParticipants((data as Participant[]) || []);
  };

  const handleSelectGuest = (guest: GuestData) => {
    setSelectedGuest(guest);
    setValidationErrors({});
    if (guest.status === "confirmed") {
      setAdults((guest.confirmed_adults || 1) - 1);
      setChildren(guest.confirmed_children || 0);
      fetchParticipants(guest.id);
      setPageState("success");
      return;
    }
    if (guest.status === "declined") {
      setPageState("declined");
      return;
    }
    setAdults(0);
    setChildren(0);
    setChildrenAges([]);
    setCompanionNames([]);
    setChildrenNames([]);
    setParticipants([]);
    setPageState("confirm");
  };

  const handleBack = () => {
    setSelectedGuest(null);
    setSearchQuery("");
    setSearchResults([]);
    setPageState("search");
  };

  const handleAdultsChange = (newValue: number) => {
    const maxAdultsCount = selectedGuest?.max_adults || 0;
    const clamped = Math.max(0, Math.min(newValue, maxAdultsCount));
    setAdults(clamped);
    if (clamped > companionNames.length) {
      setCompanionNames([...companionNames, ...Array(clamped - companionNames.length).fill("")]);
    } else {
      setCompanionNames(companionNames.slice(0, clamped));
    }
  };

  const handleChildrenChange = (newValue: number) => {
    const maxChildren = selectedGuest?.max_children || 0;
    const clamped = Math.max(0, Math.min(newValue, maxChildren));
    setChildren(clamped);
    if (clamped > childrenAges.length) {
      setChildrenAges([...childrenAges, ...Array(clamped - childrenAges.length).fill("")]);
      setChildrenNames([...childrenNames, ...Array(clamped - childrenNames.length).fill("")]);
    } else {
      setChildrenAges(childrenAges.slice(0, clamped));
      setChildrenNames(childrenNames.slice(0, clamped));
    }
  };

  const handleProceedToWhatsApp = () => {
    const errors: Record<string, string> = {};
    for (let i = 0; i < adults; i++) {
      if (!companionNames[i]?.trim()) errors[`companion_${i}`] = "Informe o nome do acompanhante.";
    }
    for (let i = 0; i < children; i++) {
      if (!childrenNames[i]?.trim()) errors[`child_name_${i}`] = "Informe o nome da criança.";
      if (!childrenAges[i]?.trim()) {
        errors[`child_age_${i}`] = "Informe a idade.";
      } else {
        const ageNum = parseInt(childrenAges[i], 10);
        if (isNaN(ageNum) || ageNum < 0 || ageNum > 17) errors[`child_age_${i}`] = "Idade inválida (0-17).";
      }
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setWhatsappInput(selectedGuest?.whatsapp || "");
    setWhatsappConfirmed(false);
    setPageState("whatsapp");
  };

  const handleConfirm = async () => {
    if (!selectedGuest || !eventId) return;
    const normalizedWa = whatsappInput ? whatsappInput.replace(/[^0-9+]/g, "") : null;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("confirm-guest", {
        body: {
          guest_id: selectedGuest.id,
          event_id: eventId,
          confirmed_adults: adults + 1,
          confirmed_children: children,
          children:
            children > 0
              ? childrenNames.map((name, i) => ({ index: i + 1, name, age: childrenAges[i] || "" }))
              : [],
          companions: adults > 0 ? companionNames.map((name, i) => ({ index: i + 1, name })) : [],
          whatsapp: normalizedWa,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await fetchParticipants(selectedGuest.id);
      setPageState("success");
    } catch (error: any) {
      toast({
        title: "Erro ao confirmar",
        description: error.message || "Não foi possível confirmar sua presença. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedGuest || !eventId) return;
    setDeclining(true);
    try {
      const { data, error } = await supabase.functions.invoke("decline-guest", {
        body: { guest_id: selectedGuest.id, event_id: eventId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSelectedGuest({ ...selectedGuest, status: "declined" });
      setPageState("declined");
    } catch (error: any) {
      toast({
        title: "Erro ao registrar",
        description: error.message || "Não foi possível registrar sua resposta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDeclining(false);
    }
  };

  const shareInvite = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: event?.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!" });
      }
    } catch {
      /* user cancelled */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#e9e0d4" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#4c0c14" }} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#e9e0d4" }}>
        <div className="text-center px-6">
          <h1 className="font-serif text-3xl mb-2" style={{ color: "#3a0a10" }}>
            Evento não encontrado
          </h1>
          <p style={{ color: "#9a8478" }}>O evento que você procura não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const formattedDate = format(new Date(event.event_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const ev = initials(event.name);

  // countdown
  const deadline = event.confirmation_deadline ? new Date(event.confirmation_deadline).getTime() : null;
  let cd = { d: 0, h: 0, m: 0, s: 0 };
  if (deadline) {
    let diff = Math.max(0, deadline - now);
    const d = Math.floor(diff / 86400000);
    diff -= d * 86400000;
    const h = Math.floor(diff / 3600000);
    diff -= h * 3600000;
    const m = Math.floor(diff / 60000);
    diff -= m * 60000;
    const s = Math.floor(diff / 1000);
    cd = { d, h, m, s };
  }
  const pad = (n: number) => String(n).padStart(2, "0");

  const totalPeople = adults + 1 + children;
  const maxAdults = selectedGuest?.max_adults || 0;
  const maxChildren = selectedGuest?.max_children || 0;
  const firstName = selectedGuest?.name.split(" ")[0] || "";

  const stepDot = (active: boolean, done?: boolean) =>
    done ? "#2f8f63" : active ? "#7a1b2a" : "#ddcfc4";

  const dot1 = pageState === "search" ? "#7a1b2a" : "#caa9b0";
  const dot2 =
    pageState === "confirm" || pageState === "whatsapp"
      ? "#7a1b2a"
      : pageState === "success"
      ? "#caa9b0"
      : "#ddcfc4";
  const dot3 = pageState === "success" ? "#2f8f63" : "#ddcfc4";

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center px-4 pt-10 pb-16 font-grotesk"
      style={{
        background: "radial-gradient(120% 80% at 50% -10%,#f3ebdf 0%,#e9e0d4 55%,#ddd0bf 100%)",
        color: "#3a0a10",
      }}
    >
      <div className="text-center max-w-[560px] mb-6">
        <p className="text-xs font-semibold tracking-[1.6px] uppercase mb-2" style={{ color: "#a8917f" }}>
          Convitei · Confirmação de presença
        </p>
        <h1 className="font-serif font-semibold text-[32px] leading-[1.05]" style={{ color: "#3a0a10" }}>
          {event.name}
        </h1>
        <p className="text-sm mt-1.5" style={{ color: "#8a7568" }}>
          {formattedDate}
        </p>
      </div>

      {/* progress dots */}
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: dot1 }} />
        <span className="w-[22px] h-[3px] rounded" style={{ background: dot1 }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: dot2 }} />
        <span className="w-[22px] h-[3px] rounded" style={{ background: dot2 }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: dot3 }} />
      </div>

      {/* phone card */}
      <div
        className="w-[382px] max-w-full overflow-hidden rounded-[34px]"
        style={{
          background: "#f7f2ec",
          boxShadow: "0 26px 60px -28px rgba(76,12,20,.55)",
          border: "1px solid #e3d6c8",
        }}
      >
        {/* ============ SEARCH / CLOSED ============ */}
        {pageState === "search" && (
          <div className="animate-fade-in">
            {/* cover */}
            <div
              className="relative h-[172px] flex flex-col items-center justify-center overflow-hidden"
              style={{ background: "linear-gradient(150deg,#4c0c14 0%,#7a1b2a 55%,#a83f57 100%)" }}
            >
              {event.cover_image_url ? (
                <img src={event.cover_image_url} alt={event.name} className="absolute inset-0 w-full h-full object-cover opacity-60" />
              ) : null}
              <Heart className="relative w-7 h-7 mb-2" style={{ color: "#ef86aa", fill: "#ef86aa" }} />
              <span className="relative font-serif font-semibold text-[30px] tracking-wide" style={{ color: "#fff" }}>
                {ev}
              </span>
              <div
                className="absolute left-0 right-0 bottom-0 h-[50px]"
                style={{ background: "linear-gradient(180deg,transparent,#f7f2ec)" }}
              />
            </div>

            <div className="px-6 pt-1.5 pb-8">
              <h2 className="font-serif font-semibold text-[27px] text-center leading-[1.1]" style={{ color: "#3a0a10" }}>
                {event.name}
              </h2>
              <p className="text-[13.5px] text-center mt-0.5" style={{ color: "#9a8478" }}>
                {formattedDate}
              </p>

              {isConfirmationsClosed ? (
                <div className="text-center py-10 px-2">
                  <div
                    className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
                    style={{ background: "#f0e6da" }}
                  >
                    <Clock className="w-7 h-7" style={{ color: "#9a8478" }} />
                  </div>
                  <h3 className="font-serif font-semibold text-[24px]" style={{ color: "#3a0a10" }}>
                    Confirmações encerradas
                  </h3>
                  <p className="text-sm mt-2" style={{ color: "#9a8478" }}>
                    O período de confirmação para este evento foi encerrado.
                  </p>
                </div>
              ) : (
                <>
                  {deadline && (
                    <div
                      className="rounded-2xl px-[18px] py-4 mt-[18px]"
                      style={{ background: "linear-gradient(155deg,#4c0c14,#7a1b2a)" }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-[15px] h-[15px]" style={{ color: "#ef86aa" }} />
                        <span className="text-[11.5px] font-semibold tracking-[0.8px] uppercase" style={{ color: "#f0c3d2" }}>
                          Confirmações encerram em
                        </span>
                      </div>
                      <div className="flex justify-center gap-[7px] mt-3">
                        {[
                          { v: String(cd.d), l: "dias" },
                          { v: pad(cd.h), l: "horas" },
                          { v: pad(cd.m), l: "min" },
                          { v: pad(cd.s), l: "seg" },
                        ].map((b) => (
                          <div
                            key={b.l}
                            className="flex-1 rounded-[11px] py-[9px] px-1 text-center"
                            style={{ background: "rgba(255,255,255,.10)" }}
                          >
                            <p className="font-bold text-[24px] leading-none" style={{ color: "#fff" }}>
                              {b.v}
                            </p>
                            <p className="text-[10px] tracking-[0.5px] uppercase mt-[3px]" style={{ color: "#e6b8c7" }}>
                              {b.l}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-center mt-3" style={{ color: "#f0c3d2" }}>
                        Prazo final ·{" "}
                        <b className="font-semibold" style={{ color: "#fff" }}>
                          {format(new Date(event.confirmation_deadline!), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </b>
                      </p>
                    </div>
                  )}

                  <p className="text-[14.5px] font-semibold text-center my-[18px]" style={{ color: "#7a1b2a" }}>
                    {event.short_message || "Confirme sua presença"}
                  </p>

                  <div
                    className="flex items-center gap-3 rounded-[14px] px-4 py-3.5 bg-white"
                    style={{ border: "2px solid #4c0c14" }}
                  >
                    <Search className="w-[19px] h-[19px] flex-none" style={{ color: "#7a1b2a" }} />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Digite seu nome…"
                      className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[15px]"
                      style={{ color: "#3a0a10" }}
                    />
                  </div>

                  {searchQuery.length >= 2 && searchResults.length > 0 && (
                    <>
                      <p className="text-[12.5px] text-center my-3.5" style={{ color: "#9a8478" }}>
                        Encontramos {searchResults.length} resultado{searchResults.length > 1 ? "s" : ""}:
                      </p>
                      <div className="space-y-2.5">
                        {searchResults.map((guest) => (
                          <div
                            key={guest.id}
                            className="flex items-center gap-3 bg-white rounded-[14px] px-[15px] py-[13px]"
                            style={{ border: "1px solid #ece2d5", boxShadow: "0 4px 14px -8px rgba(76,12,20,.25)" }}
                          >
                            <div
                              className="w-[42px] h-[42px] rounded-full flex-none flex items-center justify-center font-semibold text-sm"
                              style={{ background: "#f4e7e0", color: "#7a1b2a" }}
                            >
                              {initials(guest.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14.5px] font-semibold truncate" style={{ color: "#3a0a10" }}>
                                {guest.name}
                              </p>
                              {guest.group_name && (
                                <p className="text-xs truncate" style={{ color: "#9a8478" }}>
                                  {guest.group_name}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => handleSelectGuest(guest)}
                              className="rounded-full px-[18px] py-[9px] text-[13px] font-semibold text-white transition-colors"
                              style={{ background: "#4c0c14" }}
                            >
                              Sou eu
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {searchQuery.length >= 2 && searchResults.length === 0 && (
                    <div className="text-center py-[18px] px-1.5" style={{ color: "#9a8478" }}>
                      <p className="text-[13px]">Nenhum convidado encontrado com esse nome.</p>
                      <p className="text-xs mt-0.5">
                        Tente como aparece no convite (ex.: <b style={{ color: "#7a1b2a" }}>Ana</b>).
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ============ CONFIRM ============ */}
        {pageState === "confirm" && selectedGuest && (
          <div className="animate-fade-in px-[22px] pt-5 pb-7">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 mb-4 w-max transition-colors"
              style={{ color: "#9a8478" }}
            >
              <ArrowLeft className="w-[17px] h-[17px]" />
              <span className="text-[13.5px] font-medium">Voltar</span>
            </button>

            <div
              className="bg-white rounded-[20px] px-5 py-[22px]"
              style={{ border: "1px solid #ece2d5", boxShadow: "0 10px 30px -18px rgba(76,12,20,.3)" }}
            >
              <h2 className="font-serif font-semibold text-[25px] text-center mb-[18px]" style={{ color: "#3a0a10" }}>
                Olá, {firstName}!
              </h2>

              {maxAdults > 0 && (
                <>
                  <p className="text-[13px] text-center" style={{ color: "#7a6258" }}>
                    Você tem direito a{" "}
                    <b style={{ color: "#3a0a10" }}>
                      {maxAdults} acompanhante{maxAdults > 1 ? "s" : ""} adulto{maxAdults > 1 ? "s" : ""}
                    </b>
                  </p>
                  <Counter
                    value={adults}
                    min={0}
                    max={maxAdults}
                    onChange={handleAdultsChange}
                  />
                  {Array.from({ length: adults }).map((_, i) => (
                    <div key={i} className="mt-2.5 mb-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[12.5px] flex-none" style={{ color: "#9a8478" }}>
                          Acomp. {i + 1}
                        </span>
                        <input
                          value={companionNames[i] || ""}
                          onChange={(e) => {
                            const arr = [...companionNames];
                            arr[i] = e.target.value;
                            setCompanionNames(arr);
                          }}
                          placeholder="Nome do acompanhante"
                          maxLength={100}
                          className="flex-1 min-w-0 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium outline-none"
                          style={{
                            background: "#faf6f0",
                            border: `1px solid ${validationErrors[`companion_${i}`] ? "#b3242f" : "#e6dccf"}`,
                            color: "#3a0a10",
                          }}
                        />
                      </div>
                      {validationErrors[`companion_${i}`] && (
                        <p className="text-[11px] mt-1 ml-[64px]" style={{ color: "#b3242f" }}>
                          {validationErrors[`companion_${i}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}

              {maxAdults > 0 && maxChildren > 0 && (
                <div className="h-px my-[18px]" style={{ background: "#f0e6da" }} />
              )}

              {maxChildren > 0 && (
                <>
                  <p className="text-[13px] text-center" style={{ color: "#7a6258" }}>
                    Você pode levar até <b style={{ color: "#3a0a10" }}>{maxChildren} criança{maxChildren > 1 ? "s" : ""}</b>
                  </p>
                  <Counter
                    value={children}
                    min={0}
                    max={maxChildren}
                    onChange={handleChildrenChange}
                  />
                  {Array.from({ length: children }).map((_, i) => (
                    <div key={i} className="mt-2.5 mb-1 space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[12.5px] flex-none w-[68px]" style={{ color: "#9a8478" }}>
                          Criança {i + 1}
                        </span>
                        <input
                          value={childrenNames[i] || ""}
                          onChange={(e) => {
                            const arr = [...childrenNames];
                            arr[i] = e.target.value;
                            setChildrenNames(arr);
                          }}
                          placeholder="Nome"
                          maxLength={100}
                          className="flex-1 min-w-0 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium outline-none"
                          style={{
                            background: "#faf6f0",
                            border: `1px solid ${validationErrors[`child_name_${i}`] ? "#b3242f" : "#e6dccf"}`,
                            color: "#3a0a10",
                          }}
                        />
                        <input
                          value={childrenAges[i] || ""}
                          onChange={(e) => {
                            const arr = [...childrenAges];
                            arr[i] = e.target.value;
                            setChildrenAges(arr);
                          }}
                          placeholder="Idade"
                          type="number"
                          min={0}
                          max={17}
                          className="w-[64px] flex-none rounded-[10px] px-2 py-2.5 text-[13.5px] font-medium outline-none text-center"
                          style={{
                            background: "#faf6f0",
                            border: `1px solid ${validationErrors[`child_age_${i}`] ? "#b3242f" : "#e6dccf"}`,
                            color: "#3a0a10",
                          }}
                        />
                      </div>
                      {(validationErrors[`child_name_${i}`] || validationErrors[`child_age_${i}`]) && (
                        <p className="text-[11px] ml-[78px]" style={{ color: "#b3242f" }}>
                          {validationErrors[`child_name_${i}`] || validationErrors[`child_age_${i}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}

              <div className="rounded-xl px-4 py-[13px] mt-3.5 flex flex-col gap-1.5" style={{ background: "#faf6f0" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: "#9a8478" }}>
                    Adultos (incl. você)
                  </span>
                  <span className="text-[13.5px] font-bold" style={{ color: "#3a0a10" }}>
                    {adults + 1}
                  </span>
                </div>
                {maxChildren > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#9a8478" }}>
                      Crianças
                    </span>
                    <span className="text-[13.5px] font-bold" style={{ color: "#3a0a10" }}>
                      {children}
                    </span>
                  </div>
                )}
                <div className="h-px my-0.5" style={{ background: "#ece2d5" }} />
                <div className="flex items-center justify-between">
                  <span className="text-[13.5px] font-semibold" style={{ color: "#3a0a10" }}>
                    Total de pessoas
                  </span>
                  <span className="text-[16px] font-bold" style={{ color: "#7a1b2a" }}>
                    {totalPeople}
                  </span>
                </div>
              </div>

              <button
                onClick={handleProceedToWhatsApp}
                className="w-full rounded-[14px] py-[15px] mt-[18px] text-[15px] font-semibold text-white transition-colors"
                style={{ background: "#4c0c14" }}
              >
                Continuar
              </button>
              <button
                onClick={handleDecline}
                disabled={declining}
                className="w-full flex items-center justify-center gap-2 pt-3 pb-0.5 mt-1 text-[14px] font-semibold transition-colors disabled:opacity-50"
                style={{ color: "#9a8478" }}
              >
                {declining ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Não poderei ir
              </button>
            </div>
          </div>
        )}

        {/* ============ WHATSAPP ============ */}
        {pageState === "whatsapp" && selectedGuest && (
          <div className="animate-fade-in px-[22px] pt-5 pb-7">
            <button
              onClick={() => setPageState("confirm")}
              className="flex items-center gap-2 mb-4 w-max transition-colors"
              style={{ color: "#9a8478" }}
            >
              <ArrowLeft className="w-[17px] h-[17px]" />
              <span className="text-[13.5px] font-medium">Voltar</span>
            </button>

            <div
              className="bg-white rounded-[20px] px-5 py-[22px]"
              style={{ border: "1px solid #ece2d5", boxShadow: "0 10px 30px -18px rgba(76,12,20,.3)" }}
            >
              <h2 className="font-serif font-semibold text-[24px] text-center" style={{ color: "#3a0a10" }}>
                Seu WhatsApp
              </h2>
              <p className="text-[13px] text-center mt-1 mb-5" style={{ color: "#9a8478" }}>
                Para que o organizador possa entrar em contato
              </p>

              {selectedGuest.whatsapp && !whatsappConfirmed ? (
                <div className="space-y-4">
                  <p className="text-center text-[13px]" style={{ color: "#7a6258" }}>
                    Este ainda é seu número de WhatsApp?
                  </p>
                  <div
                    className="text-center text-base font-medium py-3 px-4 rounded-xl"
                    style={{ background: "#faf6f0", color: "#3a0a10" }}
                  >
                    {selectedGuest.whatsapp}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setWhatsappInput("");
                        setWhatsappConfirmed(true);
                      }}
                      className="h-12 rounded-xl text-[13.5px] font-semibold transition-colors"
                      style={{ background: "#fff", border: "1px solid #e3d6c8", color: "#7a1b2a" }}
                    >
                      Não, atualizar
                    </button>
                    <button
                      onClick={() => setWhatsappConfirmed(true)}
                      className="h-12 rounded-xl text-[13.5px] font-semibold text-white transition-colors"
                      style={{ background: "#4c0c14" }}
                    >
                      Sim, é esse
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-center text-[13px]" style={{ color: "#9a8478" }}>
                    Informe seu número com código do país:
                  </p>
                  <input
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    placeholder="+55 21 99999-9999"
                    type="tel"
                    className="w-full h-14 text-base text-center rounded-xl outline-none"
                    style={{ background: "#faf6f0", border: "1px solid #e6dccf", color: "#3a0a10" }}
                  />
                  <p className="text-[11px] text-center" style={{ color: "#9a8478" }}>
                    Inclua o código do país. Ex: +55 para Brasil
                  </p>
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={saving || (!whatsappInput && !selectedGuest.whatsapp)}
                className="w-full rounded-[14px] py-[15px] mt-5 text-[15px] font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center"
                style={{ background: "#4c0c14" }}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar presença"}
              </button>
            </div>
          </div>
        )}

        {/* ============ SUCCESS / QR ============ */}
        {pageState === "success" && selectedGuest && (
          <div className="animate-fade-in px-6 py-7 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "#e6f1ea" }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: "#2f8f63" }} />
            </div>
            <h2 className="font-serif font-semibold text-[26px] leading-[1.1]" style={{ color: "#3a0a10" }}>
              {selectedGuest.confirmed_at ? "Presença registrada!" : "Presença confirmada!"}
            </h2>
            <p className="text-[13.5px] mt-1.5" style={{ color: "#9a8478" }}>
              {participants.length > 1
                ? `Apresente os ${participants.length} QR Codes na entrada`
                : "Apresente este QR Code na entrada do evento"}
            </p>

            <div className="mt-4 mb-[18px]">
              <p className="font-serif font-semibold text-[18px]" style={{ color: "#7a1b2a" }}>
                {event.name}
              </p>
              <p className="text-xs" style={{ color: "#9a8478" }}>
                {formattedDate}
              </p>
            </div>

            <div className="space-y-4">
              {(participants.length > 0
                ? participants
                : [
                    {
                      id: selectedGuest.id,
                      name: selectedGuest.name,
                      type: "main",
                      age: null,
                      qr_code: selectedGuest.qr_code || selectedGuest.id,
                      checked_in_at: null,
                    } as Participant,
                  ]
              ).map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-[20px] p-[22px]"
                  style={{ border: "1px solid #ece2d5", boxShadow: "0 10px 30px -18px rgba(76,12,20,.3)" }}
                >
                  <div className="flex justify-center">
                    <QRCodeCanvas value={p.qr_code} size={170} level="H" includeMargin bgColor="#ffffff" fgColor="#2a0a10" />
                  </div>
                  <div className="border-t mt-4 pt-3.5" style={{ borderColor: "#f0e6da" }}>
                    <p className="text-[15px] font-semibold" style={{ color: "#3a0a10" }}>
                      {p.name || "Participante"}
                    </p>
                    <p className="text-[12.5px] mt-0.5" style={{ color: "#9a8478" }}>
                      {p.type === "main" ? "Convidado principal" : p.type === "adult" ? "Acompanhante" : "Criança"}
                      {p.age ? ` · ${p.age} anos` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={shareInvite}
              className="w-full flex items-center justify-center gap-2 rounded-[14px] py-3.5 mt-4 text-[14.5px] font-semibold transition-colors"
              style={{ background: "#fff", border: "1px solid #e3d6c8", color: "#4c0c14" }}
            >
              <Share2 className="w-[17px] h-[17px]" />
              Compartilhar
            </button>
            <button
              onClick={handleBack}
              className="w-full pt-3.5 text-[13.5px] font-semibold transition-colors"
              style={{ color: "#9a8478" }}
            >
              Voltar ao início
            </button>
          </div>
        )}

        {/* ============ DECLINED ============ */}
        {pageState === "declined" && selectedGuest && (
          <div className="animate-fade-in px-6 pt-9 pb-7 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "#f7e3e6" }}
            >
              <XCircle className="w-[30px] h-[30px]" style={{ color: "#b3242f" }} />
            </div>
            <h2 className="font-serif font-semibold text-[26px] leading-[1.1]" style={{ color: "#3a0a10" }}>
              Tudo bem, {firstName}.
            </h2>
            <p className="text-[13.5px] mt-2 leading-relaxed px-1.5" style={{ color: "#9a8478" }}>
              Registramos que você <b style={{ color: "#b3242f" }}>não poderá comparecer</b> ao evento {event.name}.
              Sentiremos sua falta!
            </p>

            <div
              className="bg-white rounded-[18px] px-5 py-[18px] mt-[22px] text-left"
              style={{ border: "1px solid #ece2d5", boxShadow: "0 10px 30px -20px rgba(76,12,20,.3)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-[42px] h-[42px] rounded-full flex-none flex items-center justify-center font-semibold text-sm"
                  style={{ background: "#f7e3e6", color: "#b3242f" }}
                >
                  {initials(selectedGuest.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-semibold" style={{ color: "#3a0a10" }}>
                    {selectedGuest.name}
                  </p>
                  {selectedGuest.group_name && (
                    <p className="text-xs" style={{ color: "#9a8478" }}>
                      {selectedGuest.group_name}
                    </p>
                  )}
                </div>
                <span
                  className="text-[11px] font-semibold px-[11px] py-[5px] rounded-full"
                  style={{ background: "#f7e3e6", color: "#b3242f" }}
                >
                  Recusado
                </span>
              </div>
              <div
                className="flex items-center gap-1.5 mt-3.5 pt-3"
                style={{ borderTop: "1px solid #f0e6da", color: "#9a8478" }}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs">Você pode confirmar enquanto o prazo estiver aberto</span>
              </div>
            </div>

            {!isConfirmationsClosed && (
              <button
                onClick={() => {
                  setAdults(0);
                  setChildren(0);
                  setChildrenAges([]);
                  setCompanionNames([]);
                  setChildrenNames([]);
                  setValidationErrors({});
                  setPageState("confirm");
                }}
                className="w-full flex items-center justify-center gap-2 rounded-[14px] py-[15px] mt-[18px] text-[14.5px] font-semibold text-white transition-colors"
                style={{ background: "#4c0c14" }}
              >
                <RotateCcw className="w-4 h-4" />
                Mudei de ideia, quero confirmar
              </button>
            )}
            <button
              onClick={handleBack}
              className="w-full pt-3.5 text-[13px] font-semibold transition-colors"
              style={{ color: "#9a8478" }}
            >
              Voltar ao início
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Counter = ({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) => {
  const canDec = value > min;
  const canInc = value < max;
  return (
    <div className="flex items-center justify-center gap-[22px] mt-4 mb-2">
      <button
        onClick={() => onChange(value - 1)}
        disabled={!canDec}
        className="w-[46px] h-[46px] rounded-full flex items-center justify-center transition-colors"
        style={{
          border: `2px solid ${canDec ? "#4c0c14" : "#d8cabb"}`,
          color: canDec ? "#4c0c14" : "#d8cabb",
          background: "#fff",
          cursor: canDec ? "pointer" : "not-allowed",
        }}
      >
        <Minus className="w-[18px] h-[18px]" strokeWidth={2.4} />
      </button>
      <span className="font-bold text-[30px] w-[34px] text-center" style={{ color: "#3a0a10" }}>
        {value}
      </span>
      <button
        onClick={() => onChange(value + 1)}
        disabled={!canInc}
        className="w-[46px] h-[46px] rounded-full flex items-center justify-center transition-colors"
        style={{
          border: `2px solid ${canInc ? "#4c0c14" : "#d8cabb"}`,
          background: canInc ? "#4c0c14" : "#f0e9df",
          color: canInc ? "#fff" : "#b3a194",
          cursor: canInc ? "pointer" : "not-allowed",
        }}
      >
        <Plus className="w-[18px] h-[18px]" strokeWidth={2.4} />
      </button>
    </div>
  );
};

export default PublicEvent;
