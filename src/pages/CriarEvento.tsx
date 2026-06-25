import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  X, ArrowLeft, ArrowRight, Check, QrCode, CalendarDays,
  Clock, MapPin, MessageSquare, Timer, Heart, Loader2
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────
type FormType = "qr" | "noqr";
type EventType = "Casamento" | "Aniversário" | "Chá de bebê" | "Formatura" | "Corporativo" | "Outro";

const EVENT_TYPES: { label: EventType; icon: JSX.Element }[] = [
  { label: "Casamento", icon: <Heart size={20} /> },
  {
    label: "Aniversário",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 16v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5M2 16h20M4 16v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 6V3M12 6a1.5 1.5 0 0 0 0-3" />
      </svg>
    ),
  },
  {
    label: "Chá de bebê",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2.5" /><path d="M12 7.5V14M8 11h8M9 21l3-4 3 4" />
      </svg>
    ),
  },
  {
    label: "Formatura",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
      </svg>
    ),
  },
  {
    label: "Corporativo",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  {
    label: "Outro",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
];

const COLOR_OPTIONS = [
  { hex: "#4c0c14", gradient: "linear-gradient(150deg,#4c0c14,#7a1b2a 55%,#a83f57)" },
  { hex: "#a83f57", gradient: "linear-gradient(150deg,#7a1b2a,#a83f57 55%,#ef86aa)" },
  { hex: "#6b4d8a", gradient: "linear-gradient(150deg,#3a2550,#6b4d8a 55%,#9a7bc0)" },
  { hex: "#2f8f63", gradient: "linear-gradient(150deg,#1d5a3f,#2f8f63 55%,#46a878)" },
];

const STEP_META = [
  { title: "Detalhes", subtitle: "Comece com o tipo e o nome do evento." },
  { title: "Data & local", subtitle: "Quando e onde vai acontecer?" },
  { title: "Confirmações", subtitle: "Defina as regras de presença." },
  { title: "Capa & publicar", subtitle: "Revise e deixe o convite no ar." },
];

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CriarEvento() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step
  const [step, setStep] = useState(1);

  // Step 1
  const [formType, setFormType] = useState<FormType>("qr");
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [name, setName] = useState("");
  const [shortMessage, setShortMessage] = useState("");

  // Step 2
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");

  // Step 3
  const [whatsappConfirm, setWhatsappConfirm] = useState(true);
  const [hasPrazo, setHasPrazo] = useState(false);
  const [prazoDate, setPrazoDate] = useState("");

  // Step 4
  const [colorIdx, setColorIdx] = useState(0);

  // Credits
  const [creditsQr, setCreditsQr] = useState(0);
  const [creditsStandard, setCreditsStandard] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adminCreatingFor, setAdminCreatingFor] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);
      supabase
        .from("profiles")
        .select("credits_standard, credits_qr")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setCreditsStandard(data.credits_standard ?? 0);
            setCreditsQr(data.credits_qr ?? 0);
          }
        });
    });
    try {
      const v = localStorage.getItem("confirmei_admin_creating_for");
      if (v) { setAdminCreatingFor(v); localStorage.removeItem("confirmei_admin_creating_for"); }
    } catch {}
  }, [navigate]);

  // ── Helpers ──
  const currentCredits = formType === "qr" ? creditsQr : creditsStandard;
  const previewSlug = slugify(name) || "seu-evento";
  const previewGradient = COLOR_OPTIONS[colorIdx].gradient;

  // ── Stepper ──
  const stepperItems = [
    { label: "Detalhes", short: "1" },
    { label: "Data", short: "2" },
    { label: "Confirmações", short: "3" },
    { label: "Capa", short: "4" },
  ];

  // ── Submit ──
  const handlePublish = async () => {
    if (!userId || !name.trim() || !eventDate) {
      toast({ title: "Preencha nome e data do evento", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const creditType = formType === "qr" ? "qr" : "standard";
      const { data: ev, error } = await supabase
        .from("events")
        .insert({
          user_id: userId,
          name: name.trim(),
          event_date: eventDate,
          short_message: shortMessage.trim() || null,
          primary_color: COLOR_OPTIONS[colorIdx].hex,
          checkin_mode: formType === "qr" ? "qr" : "manual",
          credit_type: creditType,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.rpc("consume_event_credit", { _user_id: userId, _credit_type: creditType });
      navigate(`/event/${ev.id}`);
    } catch (err: any) {
      toast({ title: "Erro ao criar evento", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────── RENDER ───────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#f4eee5",
        fontFamily: "'Hanken Grotesk', sans-serif",
        color: "#3a0a10",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── HEADER ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 40px",
          borderBottom: "1px solid #e6dccf",
          background: "rgba(244,238,229,0.85)",
          backdropFilter: "blur(6px)",
          position: "sticky",
          top: 0,
          zIndex: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "#4c0c14",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 700,
                fontSize: 21,
                color: "#f4eee5",
                lineHeight: 1,
              }}
            >
              C
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600,
              fontSize: 23,
              color: "#3a0a10",
            }}
          >
            Confirmei
          </span>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#7a6258",
            background: "none",
            border: "none",
            fontSize: 13.5,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Hanken Grotesk', sans-serif",
          }}
        >
          <X size={16} />
          Cancelar
        </button>
      </header>

      {/* ── WIZARD BODY ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          padding: "36px 24px 56px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 720 }}>

          {/* Heading */}
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <p
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                color: "#a8917f",
                marginBottom: 7,
              }}
            >
              Novo evento
            </p>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 600,
                fontSize: 34,
                lineHeight: 1.05,
                color: "#3a0a10",
              }}
            >
              {STEP_META[step - 1].title}
            </h1>
            <p style={{ fontSize: 14, color: "#9a8478", marginTop: 6 }}>
              {STEP_META[step - 1].subtitle}
            </p>
          </div>

          {/* Admin banner */}
          {adminCreatingFor && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "linear-gradient(135deg,#4c0c14,#7a1b2a)",
                color: "#f4eee5",
                borderRadius: 14,
                padding: "13px 18px",
                marginBottom: 22,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "1.2px",
                  textTransform: "uppercase",
                  color: "#4c0c14",
                  background: "#ef86aa",
                  padding: "4px 9px",
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                Admin
              </span>
              <span style={{ fontSize: 13.5, color: "rgba(244,238,229,0.9)" }}>
                Criando evento em nome de{" "}
                <b style={{ color: "#fff", fontWeight: 600 }}>{adminCreatingFor}</b>
              </span>
            </div>
          )}

          {/* Stepper */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: 28,
              padding: "0 8px",
            }}
          >
            {stepperItems.map((s, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div key={s.label} style={{ display: "flex", alignItems: "center", flex: n < 4 ? 1 : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13.5,
                        fontWeight: 700,
                        background: done ? "#2f8f63" : active ? "#4c0c14" : "#faf6f0",
                        color: done || active ? "#fff" : "#b3a194",
                        border: `2px solid ${done ? "#2f8f63" : active ? "#4c0c14" : "#e6dccf"}`,
                      }}
                    >
                      {done ? <Check size={14} strokeWidth={3} /> : n}
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: active ? "#3a0a10" : done ? "#5e4b40" : "#b3a194",
                        whiteSpace: "nowrap",
                      }}
                      className="stepper-label"
                    >
                      {s.label}
                    </span>
                  </div>
                  {n < 4 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        margin: "0 14px",
                        borderRadius: 2,
                        background: done ? "#2f8f63" : "#e6dccf",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── WHITE CARD ── */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #ece2d5",
              borderRadius: 20,
              padding: "30px 32px",
              boxShadow: "0 20px 48px -30px rgba(76,12,20,0.4)",
            }}
          >
            {/* ===== STEP 1 ===== */}
            {step === 1 && (
              <div>
                {/* Tipo de formulário */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 11, display: "block" }}>
                  Tipo de formulário{" "}
                  <span style={{ color: "#b3a194", fontWeight: 500 }}>— define qual crédito será usado</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 24 }}>
                  {/* Com QR */}
                  <button
                    onClick={() => setFormType("qr")}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: 9,
                      padding: "16px 15px",
                      borderRadius: 14,
                      cursor: "pointer",
                      textAlign: "left",
                      background: formType === "qr" ? "#fbf1ea" : "#faf6f0",
                      border: `1.5px solid ${formType === "qr" ? "#7a1b2a" : "#ece2d5"}`,
                    }}
                  >
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f4e7e0",
                        color: "#7a1b2a",
                      }}
                    >
                      <QrCode size={19} />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: formType === "qr" ? "#3a0a10" : "#5e4b40" }}>
                      Com QR Code
                    </span>
                    <span style={{ fontSize: 11.5, color: "#9a8478", lineHeight: 1.3 }}>
                      Confirmação + check-in na portaria
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: formType === "qr" ? "#7a1b2a" : "#b3a194" }}>
                      {creditsQr} créditos disponíveis
                    </span>
                    {formType === "qr" && (
                      <span
                        style={{
                          position: "absolute",
                          top: 13,
                          right: 13,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#7a1b2a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </span>
                    )}
                  </button>

                  {/* Sem QR */}
                  <button
                    onClick={() => setFormType("noqr")}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: 9,
                      padding: "16px 15px",
                      borderRadius: 14,
                      cursor: "pointer",
                      textAlign: "left",
                      background: formType === "noqr" ? "#eaf3ee" : "#faf6f0",
                      border: `1.5px solid ${formType === "noqr" ? "#2f8f63" : "#ece2d5"}`,
                    }}
                  >
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#e6f1ea",
                        color: "#2f8f63",
                      }}
                    >
                      <Check size={19} />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: formType === "noqr" ? "#3a0a10" : "#5e4b40" }}>
                      Sem QR Code
                    </span>
                    <span style={{ fontSize: 11.5, color: "#9a8478", lineHeight: 1.3 }}>
                      Apenas confirmação de presença
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: formType === "noqr" ? "#2f8f63" : "#b3a194" }}>
                      {creditsStandard} créditos disponíveis
                    </span>
                    {formType === "noqr" && (
                      <span
                        style={{
                          position: "absolute",
                          top: 13,
                          right: 13,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#2f8f63",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </div>

                {/* Tipo de evento */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 11, display: "block" }}>
                  Que tipo de evento é?
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 11, marginBottom: 24 }}>
                  {EVENT_TYPES.map((et) => {
                    const sel = eventType === et.label;
                    return (
                      <button
                        key={et.label}
                        onClick={() => setEventType(et.label)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 9,
                          padding: "18px 10px",
                          borderRadius: 14,
                          cursor: "pointer",
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          background: sel ? "#fbf1ea" : "#faf6f0",
                          border: `1.5px solid ${sel ? "#7a1b2a" : "#ece2d5"}`,
                        }}
                      >
                        <span
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 11,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: sel ? "#4c0c14" : "#f0e6da",
                            color: sel ? "#fff" : "#9a8478",
                          }}
                        >
                          {et.icon}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: sel ? "#7a1b2a" : "#5e4b40" }}>
                          {et.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Nome */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                  Nome do evento
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Marina & Rafael"
                  style={{
                    width: "100%",
                    border: "1px solid #e6dccf",
                    outline: "none",
                    background: "#faf6f0",
                    borderRadius: 12,
                    padding: "13px 15px",
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    fontSize: 15,
                    color: "#3a0a10",
                    marginBottom: 18,
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7a1b2a")}
                  onBlur={(e) => (e.target.style.borderColor = "#e6dccf")}
                />

                {/* Mensagem curta */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                  Mensagem curta para os convidados
                </label>
                <input
                  type="text"
                  value={shortMessage}
                  onChange={(e) => setShortMessage(e.target.value)}
                  placeholder="Confirme sua presença"
                  style={{
                    width: "100%",
                    border: "1px solid #e6dccf",
                    outline: "none",
                    background: "#faf6f0",
                    borderRadius: 12,
                    padding: "13px 15px",
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    fontSize: 15,
                    color: "#3a0a10",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7a1b2a")}
                  onBlur={(e) => (e.target.style.borderColor = "#e6dccf")}
                />
              </div>
            )}

            {/* ===== STEP 2 ===== */}
            {step === 2 && (
              <div>
                {/* Data + Horário */}
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 18 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                      Data do evento
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "#faf6f0",
                        border: "1px solid #e6dccf",
                        borderRadius: 12,
                        padding: "13px 15px",
                      }}
                    >
                      <CalendarDays size={17} color="#b3a194" />
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        style={{
                          flex: 1,
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          fontSize: 15,
                          color: "#3a0a10",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                      Horário
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "#faf6f0",
                        border: "1px solid #e6dccf",
                        borderRadius: 12,
                        padding: "13px 15px",
                      }}
                    >
                      <Clock size={17} color="#b3a194" />
                      <input
                        type="time"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        style={{
                          flex: 1,
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          fontSize: 15,
                          color: "#3a0a10",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Local */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                  Local
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "#faf6f0",
                    border: "1px solid #e6dccf",
                    borderRadius: 12,
                    padding: "13px 15px",
                    marginBottom: 18,
                  }}
                >
                  <MapPin size={17} color="#b3a194" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Villa Garden, São Paulo"
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontFamily: "'Hanken Grotesk', sans-serif",
                      fontSize: 15,
                      color: "#3a0a10",
                    }}
                  />
                </div>

                {/* Endereço */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                  Endereço completo
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua das Flores, 1200 · Jardim Europa"
                  style={{
                    width: "100%",
                    border: "1px solid #e6dccf",
                    outline: "none",
                    background: "#faf6f0",
                    borderRadius: 12,
                    padding: "13px 15px",
                    fontFamily: "'Hanken Grotesk', sans-serif",
                    fontSize: 15,
                    color: "#3a0a10",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7a1b2a")}
                  onBlur={(e) => (e.target.style.borderColor = "#e6dccf")}
                />
              </div>
            )}

            {/* ===== STEP 3 ===== */}
            {step === 3 && (
              <div>
                {/* WhatsApp toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "4px 0 18px",
                    borderBottom: "1px solid #f3ece2",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: "#e6f1ea",
                        color: "#2f8f63",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MessageSquare size={19} />
                    </span>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 600, color: "#3a0a10" }}>
                        Confirmação por WhatsApp
                      </p>
                      <p style={{ fontSize: 12.5, color: "#9a8478", marginTop: 2 }}>
                        Enviar mensagens prontas pela lista de convidados
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setWhatsappConfirm((v) => !v)}
                    style={{
                      width: 46,
                      height: 27,
                      borderRadius: 100,
                      background: whatsappConfirm ? "#4c0c14" : "#dccfc0",
                      padding: 3,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: whatsappConfirm ? "flex-end" : "flex-start",
                      flexShrink: 0,
                      cursor: "pointer",
                      border: "none",
                      transition: "background 0.2s",
                    }}
                  >
                    <div style={{ width: 21, height: 21, borderRadius: "50%", background: "#fff" }} />
                  </button>
                </div>

                {/* Prazo toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "18px 0 0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <span
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        flexShrink: 0,
                        background: "#f6ecda",
                        color: "#b07d22",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Timer size={19} />
                    </span>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 600, color: "#3a0a10" }}>Prazo para confirmar</p>
                      <p style={{ fontSize: 12.5, color: "#9a8478", marginTop: 2 }}>
                        Bloquear novas confirmações após uma data
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHasPrazo((v) => !v)}
                    style={{
                      width: 46,
                      height: 27,
                      borderRadius: 100,
                      background: hasPrazo ? "#4c0c14" : "#dccfc0",
                      padding: 3,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: hasPrazo ? "flex-end" : "flex-start",
                      flexShrink: 0,
                      cursor: "pointer",
                      border: "none",
                      transition: "background 0.2s",
                    }}
                  >
                    <div style={{ width: 21, height: 21, borderRadius: "50%", background: "#fff" }} />
                  </button>
                </div>

                {/* Prazo date field (conditional) */}
                {hasPrazo && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #f3ece2" }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                      Data limite para confirmar
                    </label>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        background: "#faf6f0",
                        border: "1px solid #e6dccf",
                        borderRadius: 12,
                        padding: "13px 15px",
                        maxWidth: 280,
                      }}
                    >
                      <CalendarDays size={17} color="#b3a194" />
                      <input
                        type="date"
                        value={prazoDate}
                        onChange={(e) => setPrazoDate(e.target.value)}
                        style={{
                          flex: 1,
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontFamily: "'Hanken Grotesk', sans-serif",
                          fontSize: 15,
                          color: "#3a0a10",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== STEP 4 ===== */}
            {step === 4 && (
              <div>
                {/* Color picker */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 10, display: "block" }}>
                  Cor do convite
                </label>
                <div style={{ display: "flex", gap: 11, marginBottom: 22 }}>
                  {COLOR_OPTIONS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setColorIdx(i)}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 13,
                        cursor: "pointer",
                        background: c.hex,
                        border: `3px solid ${colorIdx === i ? "#3a0a10" : "transparent"}`,
                        boxShadow: "0 4px 10px -4px rgba(0,0,0,0.3)",
                      }}
                    />
                  ))}
                </div>

                {/* Preview */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 10, display: "block" }}>
                  Pré-visualização do convite
                </label>
                <div
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid #ece2d5",
                    marginBottom: 22,
                  }}
                >
                  <div
                    style={{
                      height: 150,
                      background: previewGradient,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Heart size={26} fill="#ef86aa" color="#ef86aa" style={{ opacity: 0.9, marginBottom: 7 }} />
                    <span
                      style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontWeight: 600,
                        fontSize: 26,
                        color: "#fff",
                        textAlign: "center",
                        padding: "0 20px",
                      }}
                    >
                      {name.trim() || "Nome do evento"}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: "16px 18px",
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 13, color: "#9a8478" }}>Link público</p>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "#3a0a10" }}>
                        confirmei.com/{previewSlug}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#b07d22",
                        background: "#f6ecda",
                        padding: "5px 11px",
                        borderRadius: 100,
                      }}
                    >
                      Rascunho
                    </span>
                  </div>
                </div>

                {/* Credit summary */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    background: "#faf6f0",
                    border: "1px solid #e6dccf",
                    borderRadius: 14,
                    padding: "14px 17px",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: formType === "qr" ? "#7a1b2a" : "#2f8f63",
                        background: formType === "qr" ? "#f4e7e0" : "#e6f1ea",
                        padding: "5px 11px",
                        borderRadius: 100,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formType === "qr" ? "Com QR Code" : "Sem QR Code"}
                    </span>
                    <span style={{ fontSize: 13, color: "#5e4b40" }}>
                      Será usado <b style={{ color: "#3a0a10" }}>1 crédito</b> deste tipo
                    </span>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 18, color: "#3a0a10", lineHeight: 1 }}>
                      {Math.max(0, currentCredits - 1)}
                    </p>
                    <p style={{ fontSize: 11, color: "#9a8478" }}>restante(s)</p>
                  </div>
                </div>

                {/* Info card */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    background: "#e6f1ea",
                    border: "1px solid #cfe5d8",
                    borderRadius: 14,
                    padding: "15px 17px",
                  }}
                >
                  <Check size={19} color="#2f8f63" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
                  <p style={{ fontSize: 13, color: "#3a6b51", lineHeight: 1.45 }}>
                    Ao publicar, o link fica ativo na hora e você pode começar a cadastrar e convidar seus convidados.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── FOOTER NAV ── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              marginTop: 24,
            }}
          >
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#fff",
                  color: "#5e3b32",
                  border: "1px solid #e6dccf",
                  borderRadius: 12,
                  padding: "13px 22px",
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  fontSize: 14.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <ArrowLeft size={17} />
                Voltar
              </button>
            ) : (
              <div />
            )}

            <div style={{ flex: 1 }} />

            {step < 4 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  background: "#4c0c14",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "13px 26px",
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  fontSize: 14.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 10px 24px -10px rgba(76,12,20,0.6)",
                }}
              >
                Próximo
                <ArrowRight size={17} />
              </button>
            )}

            {step === 4 && (
              <button
                onClick={handlePublish}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  background: "#2f8f63",
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "13px 26px",
                  fontFamily: "'Hanken Grotesk', sans-serif",
                  fontSize: 14.5,
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 10px 24px -10px rgba(47,143,99,0.6)",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? (
                  <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Check size={17} strokeWidth={2.2} />
                )}
                Publicar evento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile stepper label hiding */}
      <style>{`
        @media (max-width: 680px) {
          .stepper-label { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
