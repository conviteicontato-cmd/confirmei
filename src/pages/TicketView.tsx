import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Heart, AlertTriangle, CheckCircle2, Calendar, MapPin, Grid3x3 } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TicketData {
  participant: {
    id: string;
    name: string | null;
    type: string;
    age: string | null;
    qr_code: string;
    checked_in_at: string | null;
  };
  guestName: string;
  groupName: string | null;
  confirmedAt: string | null;
  event: {
    id: string;
    name: string;
    event_date: string;
    cover_image_url: string | null;
  };
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const roleMeta = (type: string, age: string | null, inviter: string) => {
  if (type === "main") return { label: "Convidado principal", color: "#7a1b2a", bg: "#f4e7e0", meta: "Convidado(a) principal · adulto" };
  if (type === "child")
    return {
      label: "Acompanhante",
      color: "#b13a68",
      bg: "#fbe7ee",
      meta: `Convidado por ${inviter} · criança${age ? ` · ${age} anos` : ""}`,
    };
  return { label: "Acompanhante", color: "#3f6f9e", bg: "#e3edf5", meta: `Convidado por ${inviter} · adulto` };
};

const TicketView = () => {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketData | null>(null);

  useEffect(() => {
    const fetchTicket = async () => {
      if (!code) {
        setLoading(false);
        return;
      }
      try {
        const { data: participant } = await supabase
          .from("guest_participants")
          .select("id, name, type, age, qr_code, checked_in_at, guest_id, event_id")
          .eq("qr_code", code)
          .maybeSingle();

        if (!participant) {
          setLoading(false);
          return;
        }

        const [{ data: guest }, { data: event }] = await Promise.all([
          supabase.from("guests").select("name, group_name, confirmed_at").eq("id", participant.guest_id).maybeSingle(),
          supabase
            .from("public_events")
            .select("id, name, event_date, cover_image_url")
            .eq("id", participant.event_id)
            .maybeSingle(),
        ]);

        if (!event) {
          setLoading(false);
          return;
        }

        setTicket({
          participant: {
            id: participant.id,
            name: participant.name,
            type: participant.type,
            age: participant.age,
            qr_code: participant.qr_code,
            checked_in_at: participant.checked_in_at,
          },
          guestName: guest?.name || "Convidado",
          groupName: guest?.group_name || null,
          confirmedAt: guest?.confirmed_at || null,
          event: {
            id: event.id as string,
            name: event.name as string,
            event_date: event.event_date as string,
            cover_image_url: event.cover_image_url,
          },
        });
      } catch (err) {
        console.error("Error fetching ticket:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTicket();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#e9e0d4" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#4c0c14" }} />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#e9e0d4" }}>
        <div className="text-center max-w-sm">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3" style={{ color: "#b3242f" }} />
          <h1 className="font-serif text-2xl mb-1" style={{ color: "#3a0a10" }}>
            Ingresso não encontrado
          </h1>
          <p className="text-sm" style={{ color: "#9a8478" }}>
            O código informado não corresponde a nenhuma entrada.
          </p>
        </div>
      </div>
    );
  }

  const { participant, event, guestName, groupName, confirmedAt } = ticket;
  const used = !!participant.checked_in_at;
  const role = roleMeta(participant.type, participant.age, guestName);
  const ev = initials(event.name);
  const dateLabel = format(new Date(event.event_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const shortDate = format(new Date(event.event_date), "d MMM · HH'h'", { locale: ptBR });
  const ticketCode = participant.qr_code.slice(0, 14).toUpperCase();

  const shareWhatsApp = () => {
    const msg = `Olá, ${participant.name}! Sua presença em ${event.name} (${dateLabel}) está confirmada. Este é o seu QR Code de entrada — apresente na portaria: ${window.location.href}`;
    window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center px-5 pt-8 pb-16 font-grotesk"
      style={{
        background: "radial-gradient(120% 80% at 50% -10%,#f3ebdf 0%,#e9e0d4 55%,#ddd0bf 100%)",
        color: "#3a0a10",
      }}
    >
      <div className="w-full max-w-[392px]">
        <div
          className="relative overflow-hidden rounded-[30px]"
          style={{
            background: "#fbf7f1",
            boxShadow: "0 34px 70px -30px rgba(76,12,20,.55),0 2px 0 rgba(255,255,255,.6) inset",
            border: "1px solid #ece2d5",
          }}
        >
          {/* used banner */}
          {used && (
            <div
              className="flex items-center gap-2.5 px-[22px] py-[13px]"
              style={{ background: "linear-gradient(90deg,#6d1622,#8f2031)" }}
            >
              <AlertTriangle className="w-[19px] h-[19px] flex-none" style={{ color: "#f4c9d4" }} />
              <div>
                <p className="text-[13.5px] font-bold leading-tight" style={{ color: "#fff" }}>
                  QR Code já utilizado
                </p>
                <p className="text-[11.5px] mt-px" style={{ color: "#f0c3d2" }}>
                  Esta entrada já passou pela portaria
                </p>
              </div>
            </div>
          )}

          {/* cover */}
          <div
            className="relative h-[150px] flex flex-col items-center justify-center overflow-hidden"
            style={{ background: "linear-gradient(150deg,#4c0c14 0%,#7a1b2a 55%,#a83f57 100%)" }}
          >
            {event.cover_image_url && (
              <img src={event.cover_image_url} alt={event.name} className="absolute inset-0 w-full h-full object-cover opacity-50" />
            )}
            <Heart className="relative w-[26px] h-[26px] mb-1.5" style={{ color: "#ef86aa", fill: "#ef86aa" }} />
            <span className="relative font-serif font-semibold text-[30px] tracking-wide" style={{ color: "#fff" }}>
              {ev}
            </span>
            <p className="relative text-xs mt-0.5" style={{ color: "rgba(255,255,255,.78)" }}>
              {event.name} · {format(new Date(event.event_date), "d MMM yyyy", { locale: ptBR })}
            </p>
          </div>

          {/* person */}
          <div className="px-[26px] pt-[22px] pb-1 text-center">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.7px] uppercase px-3 py-[5px] rounded-full"
              style={{ color: role.color, background: role.bg }}
            >
              {role.label}
            </span>
            <h2 className="font-serif font-semibold text-[28px] leading-[1.1] mt-2.5" style={{ color: "#3a0a10" }}>
              {participant.name || guestName}
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: "#9a8478" }}>
              {role.meta}
            </p>
          </div>

          {/* QR */}
          <div className="px-[26px] pt-[18px] pb-1.5">
            <div
              className="relative bg-white rounded-[22px] p-[22px]"
              style={{ border: "1px solid #ece2d5", boxShadow: "0 12px 30px -20px rgba(76,12,20,.4)" }}
            >
              <div
                className="mx-auto flex items-center justify-center"
                style={{ width: 198, height: 198, opacity: used ? 0.45 : 1, filter: used ? "grayscale(1)" : "none" }}
              >
                <QRCodeCanvas
                  value={participant.qr_code}
                  size={198}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor={used ? "#b6a8a0" : "#2a0a10"}
                />
              </div>

              {used && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="rounded-xl px-[18px] py-[9px]"
                    style={{
                      border: "3.5px solid #b3242f",
                      color: "#b3242f",
                      transform: "rotate(-12deg)",
                      background: "rgba(251,247,241,.7)",
                      boxShadow: "0 6px 18px -8px rgba(179,36,47,.5)",
                    }}
                  >
                    <p className="font-extrabold text-[20px] tracking-[2px] leading-none">UTILIZADO</p>
                    <p className="text-[10.5px] font-bold tracking-[1px] text-center mt-0.5">CHECK-IN OK</p>
                  </div>
                </div>
              )}

              <div className="mt-[18px] pt-3.5 text-center" style={{ borderTop: "1px dashed #e6dccf" }}>
                <p className="text-[10.5px] font-semibold tracking-[1px] uppercase" style={{ color: "#b3a194" }}>
                  Código da entrada
                </p>
                <p className="font-bold text-[16px] tracking-[3px] mt-1" style={{ color: "#3a0a10" }}>
                  {ticketCode}
                </p>
              </div>
            </div>
          </div>

          {/* perforation */}
          <div className="relative h-[26px] flex items-center my-1.5">
            <div className="absolute -left-[13px] w-[26px] h-[26px] rounded-full" style={{ background: "#e9e0d4" }} />
            <div className="absolute -right-[13px] w-[26px] h-[26px] rounded-full" style={{ background: "#e9e0d4" }} />
            <div className="flex-1 mx-[18px]" style={{ borderTop: "2px dashed #e0d4c5" }} />
          </div>

          {/* meta rows */}
          <div className="px-[26px] pt-0.5 pb-[26px] flex flex-col gap-[11px]">
            <div
              className="flex items-center gap-3 rounded-[13px] px-[15px] py-[13px]"
              style={{
                background: used ? "#faf6f0" : "#eef5f0",
                border: `1px solid ${used ? "#e6dccf" : "#cfe5d8"}`,
              }}
            >
              <span
                className="w-9 h-9 rounded-[10px] flex-none flex items-center justify-center"
                style={{ background: used ? "#f0e6da" : "#dcefe4", color: used ? "#9a8478" : "#2f8f63" }}
              >
                <CheckCircle2 className="w-[18px] h-[18px]" />
              </span>
              <div className="flex-1">
                <p className="text-[11.5px]" style={{ color: "#9a8478" }}>
                  Confirmado em
                </p>
                <p className="text-[14px] font-semibold mt-px" style={{ color: "#3a0a10" }}>
                  {confirmedAt
                    ? format(new Date(confirmedAt), "d 'de' MMMM 'de' yyyy · HH'h'mm", { locale: ptBR })
                    : "—"}
                </p>
              </div>
            </div>

            {used && (
              <div
                className="flex items-center gap-3 rounded-[13px] px-[15px] py-[13px]"
                style={{ background: "#fbe9ec", border: "1px solid #f1cdd5" }}
              >
                <span
                  className="w-9 h-9 rounded-[10px] flex-none flex items-center justify-center"
                  style={{ background: "#f3d2da", color: "#b3242f" }}
                >
                  <Grid3x3 className="w-[18px] h-[18px]" />
                </span>
                <div className="flex-1">
                  <p className="text-[11.5px]" style={{ color: "#b3697a" }}>
                    Check-in realizado em
                  </p>
                  <p className="text-[14px] font-bold mt-px" style={{ color: "#8f2031" }}>
                    {format(new Date(participant.checked_in_at!), "d 'de' MMMM 'de' yyyy · HH'h'mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-[11px]">
              <div
                className="flex-1 flex items-center gap-[11px] rounded-[13px] px-3.5 py-3"
                style={{ background: "#faf6f0", border: "1px solid #e6dccf" }}
              >
                <Calendar className="w-[17px] h-[17px] flex-none" style={{ color: "#b07d22" }} />
                <div className="min-w-0">
                  <p className="text-[11px]" style={{ color: "#9a8478" }}>
                    Data
                  </p>
                  <p className="text-[13px] font-semibold mt-px truncate" style={{ color: "#3a0a10" }}>
                    {shortDate}
                  </p>
                </div>
              </div>
              <div
                className="flex-1 flex items-center gap-[11px] rounded-[13px] px-3.5 py-3"
                style={{ background: "#faf6f0", border: "1px solid #e6dccf" }}
              >
                <MapPin className="w-[17px] h-[17px] flex-none" style={{ color: "#7a1b2a" }} />
                <div className="min-w-0">
                  <p className="text-[11px]" style={{ color: "#9a8478" }}>
                    Evento
                  </p>
                  <p className="text-[13px] font-semibold mt-px truncate" style={{ color: "#3a0a10" }}>
                    {event.name}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-center leading-relaxed mt-0.5" style={{ color: "#9a8478" }}>
              {used
                ? "Esta entrada já foi validada. Cada pessoa tem um QR Code único e de uso único."
                : "Apresente este QR Code na portaria. Ele é individual e válido para uma única entrada."}
            </p>
          </div>
        </div>

        {/* share */}
        <button
          onClick={shareWhatsApp}
          className="w-full flex items-center justify-center gap-2.5 rounded-[15px] py-[15px] mt-4 text-[14.5px] font-semibold text-white transition-colors"
          style={{ background: "#4c0c14", boxShadow: "0 14px 30px -14px rgba(76,12,20,.6)" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" />
          </svg>
          Enviar pelo WhatsApp
        </button>
      </div>
    </div>
  );
};

export default TicketView;
