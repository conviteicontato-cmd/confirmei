import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
importar {
  X, Seta para a Esquerda, Seta para a Direita, Verificar, Código QR, Dias do Calendário,
  Relógio, Marcador de Mapa, Quadrado de Mensagem, Cronômetro, Coração, Carregador 2
} de "lucide-react";

// ─── Tipos ───────────────────────────────── ──────────────────────────────────
tipo FormType = "qr" | "noqr";
type EventType = "Casamento" | "Aniversário" | "Chá de bebê" | "Formatura" | "Corporativo" | "Outro";

const EVENT_TYPES: { label: EventType; icon: JSX.Element }[] = [
  { label: "Casamento", icon: <Heart size={20} /> },
  {
    rótulo: "Aniversário",
    ícone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 16v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5M2 16h20M4 16v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 6V3M12 6a1.5 1.5 0 0 0 0-3" />
      </svg>
    ),
  },
  {
    rótulo: "Chá de bebê",
    ícone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2.5" /><path d="M12 7.5V14M8 11h8M9 21l3-4 3 4" />
      </svg>
    ),
  },
  {
    rótulo: "Formatura",
    ícone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" />
      </svg>
    ),
  },
  {
    rótulo: "Corporativo",
    ícone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  {
    rótulo: "Outro",
    ícone: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
];

const OPÇÕES_DE_COR = [
  { hex: "#4c0c14", gradient: "linear-gradient(150deg,#4c0c14,#7a1b2a 55%,#a83f57)" },
  { hex: "#a83f57", gradient: "linear-gradient(150deg,#7a1b2a,#a83f57 55%,#ef86aa)" },
  { hex: "#6b4d8a", gradient: "linear-gradient(150deg,#3a2550,#6b4d8a 55%,#9a7bc0)" },
  { hex: "#2f8f63", gradient: "linear-gradient(150deg,#1d5a3f,#2f8f63 55%,#46a878)" },
];

const STEP_META = [
  { title: "Detalhes", subtitle: "Comece com o tipo e o nome do evento." },
  { title: "Data & local", subtitle: "Quando e onde vai acontecer?" },
  { título: "Confirmações", subtítulo: "Definição das regras de presença." },
  { title: "Capa & publicar", subtitle: "Revise e deixe o convite no ar." },
];

função slugify(str: string) {
  retornar str
    .paraLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Componente principal ────────────────────────── ───────────────────────────
exportar função padrão CriarEvento() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Etapa
  const [passo, definirPasso] = useState(1);

  // Passo 1
  const [formType, setFormType] = useState<FormType>("qr");
  const [eventType, setEventType] = useState<EventType | nulo>(nulo);
  const [nome, setNome] = useState("");
  const [shortMessage, setShortMessage] = useState("");

  // Etapa 2
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");

  // Etapa 3
  const [whatsappConfirm, setWhatsappConfirm] = useState(true);
  const [hasPrazo, setHasPrazo] = useState(false);
  const [prazoDate, setPrazoDate] = useState("");

  // Etapa 4
  const [colorIdx, setColorIdx] = useState(0);

  // Créditos
  const [créditosQr, setCreditsQr] = useState(0);
  const [creditsStandard, setCreditsStandard] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [carregando, setLoading] = useState(false);
  const [adminCreatingFor, setAdminCreatingFor] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate("/auth"); return; }
      definirUserId(user.id);
      superbase
        .de("perfis")
        .select("credits_standard, credits_qr")
        .eq("id", user.id)
        .solteiro()
        .then(({ dados }) => {
          se (dados) {
            setCreditsStandard(data.credits_standard ?? 0);
            setCreditsQr(data.credits_qr ?? 0);
          }
        });
    });
    tentar {
      const v = localStorage.getItem("confirmei_admin_creating_for");
      if (v) { setAdminCreatingFor(v); localStorage.removeItem("confirmei_admin_creating_for"); }
    } pegar {}
  }, [navegar]);

  // ── Ajudantes ──
  const currentCredits = formType === "qr" ? creditsQr : creditsStandard;
  const previewSlug = slugify(name) || "seu-evento";
  const previewGradient = COLOR_OPTIONS[colorIdx].gradient;

  // ── Stepper ──
  const stepperItems = [
    { label: "Detalhes", short: "1" },
    { label: "Dados", short: "2" },
    { label: "Confirmações", short: "3" },
    { label: "Capa", short: "4" },
  ];

  // ── Enviar ──
  const handlePublish = async () => {
    if (!userId || !name.trim() || !eventDate) {
      brinde({ title: "Preencha nome e dados do evento", variante: "destrutivo" });
      retornar;
    }
    definirCarregando(verdadeiro);
    tentar {
      const creditType = formType === "qr" ? "qr" : "standard";
      const { data: ev, error } = await supabase
        .de("eventos")
        .inserir({
          user_id: userId,
          nome: nome.trim(),
          data_do_evento: data_do_evento,
          mensagem_curta: mensagem_curta.trim() || null,
          cor_primária: OPÇÕES_DE_CORES[idx_da_cor].hex,
          checkin_mode: formType === "qr" ? "qr" : "manual",
          tipo_de_crédito: tipo_de_crédito,
        })
        .selecionar()
        .solteiro();
      se (erro) lançar erro;

      await supabase.rpc("consume_event_credit", { _user_id: userId, _credit_type: creditType });
      navegar(`/evento/${ev.id}`);
    } catch (erro: qualquer) {
      brinde({ título: "Erro ao criar evento", descrição: err.message, variante: "destrutivo" });
    } finalmente {
      definirCarregando(falso);
    }
  };

  // ──────────────────────────────── RENDERIZAR ────────────────────────────────────
  retornar (
    <div
      estilo={{
        minHeight: "100vh",
        largura: "100%",
        fundo: "#f4eee5",
        fontFamily: "'Hanken Grotesk', sem serifa",
        cor: "#3a0a10",
        exibir: "flex",
        flexDirection: "coluna",
      }}
    >
      {/* ── CABEÇALHO ── */}
      <cabeçalho
        estilo={{
          exibir: "flex",
          alignItems: "center",
          intervalo: 16,
          preenchimento: "18px 40px",
          borderBottom: "1px solid #e6dccf",
          fundo: "rgba(244,238,229,0.85)",
          backdropFilter: "blur(6px)",
          posição: "pegajoso",
          topo: 0,
          zIndex: 5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, flex: 1 }}>
          <div
            estilo={{
              largura: 32,
              altura: 32,
              borderRadius: 9,
              fundo: "#4c0c14",
              exibir: "flex",
              alignItems: "center",
              justifyContent: "centro",
              flexShrink: 0,
            }}
          >
            <span
              estilo={{
                fontFamily: "'Cormorant Garamond', serif",
                Peso da fonte: 700,
                Tamanho da fonte: 21,
                cor: "#f4eee5",
                alturaDaLinha: 1,
              }}
            >
              C
            </span>
          </div>
          <span
            estilo={{
              fontFamily: "'Cormorant Garamond', serif",
              Peso da fonte: 600,
              Tamanho da fonte: 23,
              cor: "#3a0a10",
            }}
          >
            Confirmei
          </span>
        </div>
        <botão
          onClick={() => navigate("/dashboard")}
          estilo={{
            exibir: "flex",
            alignItems: "center",
            intervalo: 8,
            cor: "#7a6258",
            fundo: "nenhum",
            fronteira: "nenhuma",
            Tamanho da fonte: 13,5
            Peso da fonte: 600,
            cursor: "ponteiro",
            fontFamily: "'Hanken Grotesk', sem serifa",
          }}
        >
          <X size={16} />
          Cancelar
        </button>
      </header>

      {/* ── CORPO DE MAGO ── */}
      <div
        estilo={{
          flex: 1,
          exibir: "flex",
          justifyContent: "centro",
          preenchimento: "36px 24px 56px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 720 }}>

          {/* Cabeçalho */}
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <p
              estilo={{
                Tamanho da fonte: 11,5,
                Peso da fonte: 600,
                Espaçamento entre letras: "1,6px",
                textTransform: "maiúsculas",
                cor: "#a8917f",
                margemInferior: 7,
              }}
            >
              Novo evento
            </p>
            <h1
              estilo={{
                fontFamily: "'Cormorant Garamond', serif",
                Peso da fonte: 600,
                Tamanho da fonte: 34,
                alturaDaLinha: 1,05,
                cor: "#3a0a10",
              }}
            >
              {STEP_META[step - 1].title}
            </h1>
            <p style={{ fontSize: 14, color: "#9a8478", marginTop: 6 }}>
              {STEP_META[step - 1].subtitle}
            </p>
          </div>

          {/* Banner do administrador */}
          {adminCriandoPara && (
            <div
              estilo={{
                exibir: "flex",
                alignItems: "center",
                intervalo: 12,
                fundo: "linear-gradient(135deg,#4c0c14,#7a1b2a)",
                cor: "#f4eee5",
                borderRadius: 14,
                preenchimento: "13px 18px",
                margemInferior: 22,
              }}
            >
              <span
                estilo={{
                  Tamanho da fonte: 10,
                  Peso da fonte: 700,
                  Espaçamento entre letras: "1,2px",
                  textTransform: "maiúsculas",
                  cor: "#4c0c14",
                  fundo: "#ef86aa",
                  preenchimento: "4px 9px",
                  borderRadius: 6,
                  flexShrink: 0,
                }}
              >
                Administrador
              </span>
              <span style={{ fontSize: 13.5, color: "rgba(244,238,229,0.9)" }}>
                Criando evento em nome de{" "}
                <b style={{ color: "#fff", fontWeight: 600 }}>{adminCreatingFor}</b>
              </span>
            </div>
          )}

          {/* Stepper */}
          <div
            estilo={{
              exibir: "flex",
              alignItems: "center",
              margemInferior: 28,
              preenchimento: "0 8px",
            }}
          >
            {stepperItems.map((s, i) => {
              const n = i + 1;
              const feito = passo > n;
              const active = step === n;
              retornar (
                <div key={s.label} style={{ display: "flex", alignItems: "center", flex: n < 4 ? 1 : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div
                      estilo={{
                        largura: 34,
                        altura: 34,
                        borderRadius: "50%",
                        exibir: "flex",
                        alignItems: "center",
                        justifyContent: "centro",
                        Tamanho da fonte: 13,5
                        Peso da fonte: 700,
                        fundo: concluído ? "#2f8f63" : ativo ? "#4c0c14" : "#faf6f0",
                        cor: concluído || ativo ? "#fff" : "#b3a194",
                        borda: `2px sólida ${concluído ? "#2f8f63" : ativo ? "#4c0c14" : "#e6dccf"}`,
                      }}
                    >
                      {concluído ? <Check size={14} strokeWidth={3} /> : n}
                    </div>
                    <span
                      estilo={{
                        Tamanho da fonte: 13,
                        Peso da fonte: 600,
                        cor: ativo ? "#3a0a10" : concluído ? "#5e4b40" : "#b3a194",
                        whiteSpace: "nowrap",
                      }}
                      className="stepper-label"
                    >
                      {s.label}
                    </span>
                  </div>
                  {n < 4 && (
                    <div
                      estilo={{
                        flex: 1,
                        altura: 2,
                        margem: "0 14px",
                        raioDaBorda: 2,
                        fundo: concluído ? "#2f8f63" : "#e6dccf",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── CARTÃO BRANCO ── */}
          <div
            estilo={{
              fundo: "#fff",
              borda: "1px sólida #ece2d5",
              borderRadius: 20,
              preenchimento: "30px 32px",
              boxShadow: "0 20px 48px -30px rgba(76,12,20,0.4)",
            }}
          >
            {/* ===== PASSO 1 ===== */}
            {passo === 1 && (
              <div>
                {/* Tipo de formulário */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 11, display: "block" }}>
                  Tipo de ‡{" "}
                  <span style={{ color: "#b3a194", fontWeight: 500 }}>— definir qual crédito será usado</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 24 }}>
                  {/* Com QR Code */}
                  <botão
                    onClick={() => setFormType("qr")}
                    estilo={{
                      posição: "relativa",
                      exibir: "flex",
                      flexDirection: "coluna",
                      intervalo: 9,
                      preenchimento: "16px 15px",
                      borderRadius: 14,
                      cursor: "ponteiro",
                      alinhamento do texto: "esquerda",
                      background: formType === "qr" ? "#fbf1ea" : "#faf6f0",
                      borda: `1,5px sólida ${formType === "qr" ? "#7a1b2a" : "#ece2d5"}`,
                    }}
                  >
                    <span
                      estilo={{
                        largura: 38,
                        altura: 38,
                        borderRadius: 10,
                        exibir: "flex",
                        alignItems: "center",
                        justifyContent: "centro",
                        fundo: "#f4e7e0",
                        cor: "#7a1b2a",
                      }}
                    >
                      <QrCode size={19} />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: formType === "qr" ? "#3a0a10" : "#5e4b40" }}>
                      Com código QR
                    </span>
                    <span style={{ fontSize: 11.5, color: "#9a8478", lineHeight: 1.3 }}>
                      Confirmação + check-in na portaria
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: formType === "qr" ? "#7a1b2a" : "#b3a194" }}>
                      {creditsQr} créditos disponíveis
                    </span>
                    {formType === "qr" && (
                      <span
                        estilo={{
                          posição: "absoluta",
                          topo: 13,
                          direita: 13,
                          largura: 20,
                          altura: 20,
                          borderRadius: "50%",
                          fundo: "#7a1b2a",
                          exibir: "flex",
                          alignItems: "center",
                          justifyContent: "centro",
                        }}
                      >
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </span>
                    )}
                  </button>

                  {/* Sem QR */}
                  <botão
                    onClick={() => setFormType("noqr")}
                    estilo={{
                      posição: "relativa",
                      exibir: "flex",
                      flexDirection: "coluna",
                      intervalo: 9,
                      preenchimento: "16px 15px",
                      borderRadius: 14,
                      cursor: "ponteiro",
                      alinhamento do texto: "esquerda",
                      background: formType === "noqr" ? "#eaf3ee" : "#faf6f0",
                      borda: `1,5px sólida ${formType === "noqr" ? "#2f8f63" : "#ece2d5"}`,
                    }}
                  >
                    <span
                      estilo={{
                        largura: 38,
                        altura: 38,
                        borderRadius: 10,
                        exibir: "flex",
                        alignItems: "center",
                        justifyContent: "centro",
                        fundo: "#e6f1ea",
                        cor: "#2f8f63",
                      }}
                    >
                      <Verificar tamanho={19} />
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: formType === "noqr" ? "#3a0a10" : "#5e4b40" }}>
                      Código QR Sem
                    </span>
                    <span style={{ fontSize: 11.5, color: "#9a8478", lineHeight: 1.3 }}>
                      Apenas autorização de presença
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: formType === "noqr" ? "#2f8f63" : "#b3a194" }}>
                      {creditsStandard} créditos disponíveis
                    </span>
                    {formType === "noqr" && (
                      <span
                        estilo={{
                          posição: "absoluta",
                          topo: 13,
                          direita: 13,
                          largura: 20,
                          altura: 20,
                          borderRadius: "50%",
                          fundo: "#2f8f63",
                          exibir: "flex",
                          alignItems: "center",
                          justifyContent: "centro",
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
                    retornar (
                      <botão
                        chave={et.rótulo}
                        onClick={() => setEventType(et.label)}
                        estilo={{
                          exibir: "flex",
                          flexDirection: "coluna",
                          alignItems: "center",
                          intervalo: 9,
                          preenchimento: "18px 10px",
                          borderRadius: 14,
                          cursor: "ponteiro",
                          fontFamily: "'Hanken Grotesk', sem serifa",
                          fundo: sel ? "#fbf1ea" : "#faf6f0",
                          borda: `1,5px sólida ${sel ? "#7a1b2a" : "#ece2d5"}`,
                        }}
                      >
                        <span
                          estilo={{
                            largura: 40,
                            altura: 40,
                            borderRadius: 11,
                            exibir: "flex",
                            alignItems: "center",
                            justifyContent: "centro",
                            fundo: sel ? "#4c0c14" : "#f0e6da",
                            cor: sel ? "#fff" : "#9a8478",
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
                <entrada
                  tipo="texto"
                  valor={nome}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Marina e Rafael"
                  estilo={{
                    largura: "100%",
                    borda: "1px sólida #e6dccf",
                    esboço: "nenhum",
                    fundo: "#faf6f0",
                    borderRadius: 12,
                    preenchimento: "13px 15px",
                    fontFamily: "'Hanken Grotesk', sem serifa",
                    Tamanho da fonte: 15,
                    cor: "#3a0a10",
                    margemInferior: 18,
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7a1b2a")}
                  onBlur={(e) => (e.target.style.borderColor = "#e6dccf")}
                />

                {/* Mensagem curta */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                  Mensagem curta para os convidados
                </label>
                <entrada
                  tipo="texto"
                  valor={mensagemcurta}
                  onChange={(e) => setShortMessage(e.target.value)}
                  placeholder="Confirme sua presença"
                  estilo={{
                    largura: "100%",
                    borda: "1px sólida #e6dccf",
                    esboço: "nenhum",
                    fundo: "#faf6f0",
                    borderRadius: 12,
                    preenchimento: "13px 15px",
                    fontFamily: "'Hanken Grotesk', sem serifa",
                    Tamanho da fonte: 15,
                    cor: "#3a0a10",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7a1b2a")}
                  onBlur={(e) => (e.target.style.borderColor = "#e6dccf")}
                />
              </div>
            )}

            {/* ===== PASSO 2 ===== */}
            {passo === 2 && (
              <div>
                {/* Data + Horário */}
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 18 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                      Dados do evento
                    </label>
                    <div
                      estilo={{
                        exibir: "flex",
                        alignItems: "center",
                        intervalo: 10,
                        fundo: "#faf6f0",
                        borda: "1px sólida #e6dccf",
                        borderRadius: 12,
                        preenchimento: "13px 15px",
                      }}
                    >
                      <CalendarDays size={17} color="#b3a194" />
                      <entrada
                        tipo="data"
                        valor={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        estilo={{
                          flex: 1,
                          fronteira: "nenhuma",
                          esboço: "nenhum",
                          fundo: "transparente",
                          fontFamily: "'Hanken Grotesk', sem serifa",
                          Tamanho da fonte: 15,
                          cor: "#3a0a10",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                      Horário
                    </label>
                    <div
                      estilo={{
                        exibir: "flex",
                        alignItems: "center",
                        intervalo: 10,
                        fundo: "#faf6f0",
                        borda: "1px sólida #e6dccf",
                        borderRadius: 12,
                        preenchimento: "13px 15px",
                      }}
                    >
                      <Clock size={17} color="#b3a194" />
                      <entrada
                        tipo="tempo"
                        valor={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        estilo={{
                          flex: 1,
                          fronteira: "nenhuma",
                          esboço: "nenhum",
                          fundo: "transparente",
                          fontFamily: "'Hanken Grotesk', sem serifa",
                          Tamanho da fonte: 15,
                          cor: "#3a0a10",
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
                  estilo={{
                    exibir: "flex",
                    alignItems: "center",
                    intervalo: 10,
                    fundo: "#faf6f0",
                    borda: "1px sólida #e6dccf",
                    borderRadius: 12,
                    preenchimento: "13px 15px",
                    margemInferior: 18,
                  }}
                >
                  <MapPin size={17} color="#b3a194" />
                  <entrada
                    tipo="texto"
                    valor={localização}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Villa Garden, São Paulo"
                    estilo={{
                      flex: 1,
                      fronteira: "nenhuma",
                      esboço: "nenhum",
                      fundo: "transparente",
                      fontFamily: "'Hanken Grotesk', sem serifa",
                      Tamanho da fonte: 15,
                      cor: "#3a0a10",
                    }}
                  />
                </div>

                {/* Endereço */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                  Endereço completo
                </label>
                <entrada
                  tipo="texto"
                  valor={endereço}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua das Flores, 1200 · Jardim Europa"
                  estilo={{
                    largura: "100%",
                    borda: "1px sólida #e6dccf",
                    esboço: "nenhum",
                    fundo: "#faf6f0",
                    borderRadius: 12,
                    preenchimento: "13px 15px",
                    fontFamily: "'Hanken Grotesk', sem serifa",
                    Tamanho da fonte: 15,
                    cor: "#3a0a10",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#7a1b2a")}
                  onBlur={(e) => (e.target.style.borderColor = "#e6dccf")}
                />
              </div>
            )}

            {/* ===== PASSO 3 ===== */}
            {passo === 3 && (
              <div>
                {/* Alternar WhatsApp */}
                <div
                  estilo={{
                    exibir: "flex",
                    alignItems: "center",
                    justifyContent: "espaço-entre",
                    intervalo: 16,
                    preenchimento: "4px 0 18px",
                    borderBottom: "1px solid #f3ece2",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <span
                      estilo={{
                        largura: 38,
                        altura: 38,
                        borderRadius: 10,
                        flexShrink: 0,
                        fundo: "#e6f1ea",
                        cor: "#2f8f63",
                        exibir: "flex",
                        alignItems: "center",
                        justifyContent: "centro",
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
                  <botão
                    onClick={() => setWhatsappConfirm((v) => !v)}
                    estilo={{
                      largura: 46,
                      altura: 27,
                      raioDaBorda: 100,
                      background: whatsappConfirm ? "#4c0c14" : "#dccfc0",
                      acolchoamento: 3,
                      exibir: "flex",
                      alignItems: "center",
                      justifyContent: whatsappConfirm ? "flex-end" : "flex-start",
                      flexShrink: 0,
                      cursor: "ponteiro",
                      fronteira: "nenhuma",
                      transição: "fundo 0,2s",
                    }}
                  >
                    <div style={{ width: 21, height: 21, borderRadius: "50%", background: "#fff" }} />
                  </button>
                </div>

                {/* Alternar Prazo */}
                <div
                  estilo={{
                    exibir: "flex",
                    alignItems: "center",
                    justifyContent: "espaço-entre",
                    intervalo: 16,
                    preenchimento: "18px 0 0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                    <span
                      estilo={{
                        largura: 38,
                        altura: 38,
                        borderRadius: 10,
                        flexShrink: 0,
                        fundo: "#f6ecda",
                        cor: "#b07d22",
                        exibir: "flex",
                        alignItems: "center",
                        justifyContent: "centro",
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
                  <botão
                    onClick={() => setHasPrazo((v) => !v)}
                    estilo={{
                      largura: 46,
                      altura: 27,
                      raioDaBorda: 100,
                      background: hasPrazo ? "#4c0c14" : "#dccfc0",
                      acolchoamento: 3,
                      exibir: "flex",
                      alignItems: "center",
                      justifyContent: hasPrazo ? "flex-end" : "flex-start",
                      flexShrink: 0,
                      cursor: "ponteiro",
                      fronteira: "nenhuma",
                      transição: "fundo 0,2s",
                    }}
                  >
                    <div style={{ width: 21, height: 21, borderRadius: "50%", background: "#fff" }} />
                  </button>
                </div>

                {/* Campo de data Prazo (condicional) */}
                {hasPrazo && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #f3ece2" }}>
                    <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 8, display: "block" }}>
                      Limite de dados para confirmação
                    </label>
                    <div
                      estilo={{
                        exibir: "flex",
                        alignItems: "center",
                        intervalo: 10,
                        fundo: "#faf6f0",
                        borda: "1px sólida #e6dccf",
                        borderRadius: 12,
                        preenchimento: "13px 15px",
                        largura máxima: 280,
                      }}
                    >
                      <CalendarDays size={17} color="#b3a194" />
                      <entrada
                        tipo="data"
                        valor={prazoDate}
                        onChange={(e) => setPrazoDate(e.target.value)}
                        estilo={{
                          flex: 1,
                          fronteira: "nenhuma",
                          esboço: "nenhum",
                          fundo: "transparente",
                          fontFamily: "'Hanken Grotesk', sem serifa",
                          Tamanho da fonte: 15,
                          cor: "#3a0a10",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== PASSO 4 ===== */}
            {passo === 4 && (
              <div>
                {/* Seletor de cores */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 10, display: "block" }}>
                  Cor do torneio
                </label>
                <div style={{ display: "flex", gap: 11, marginBottom: 22 }}>
                  {COLOR_OPTIONS.map((c, i) => (
                    <botão
                      chave={i}
                      onClick={() => setColorIdx(i)}
                      estilo={{
                        largura: 46,
                        altura: 46,
                        borderRadius: 13,
                        cursor: "ponteiro",
                        fundo: c.hex,
                        borda: `3px sólida ${colorIdx === i ? "#3a0a10" : "transparente"}`,
                        boxShadow: "0 4px 10px -4px rgba(0,0,0,0.3)",
                      }}
                    />
                  ))}
                </div>

                {/* Pré-visualização */}
                <label style={{ fontSize: 12.5, fontWeight: 600, color: "#7a6258", marginBottom: 10, display: "block" }}>
                  Pré-visualização do convite
                </label>
                <div
                  estilo={{
                    borderRadius: 16,
                    overflow: "oculto",
                    borda: "1px sólida #ece2d5",
                    margemInferior: 22,
                  }}
                >
                  <div
                    estilo={{
                      altura: 150,
                      fundo: pré-visualizaçãoGradiente,
                      exibir: "flex",
                      flexDirection: "coluna",
                      alignItems: "center",
                      justifyContent: "centro",
                    }}
                  >
                    <Heart size={26} fill="#ef86aa" color="#ef86aa" style={{ opacity: 0.9, marginBottom: 7 }} />
                    <span
                      estilo={{
                        fontFamily: "'Cormorant Garamond', serif",
                        Peso da fonte: 600,
                        Tamanho da fonte: 26,
                        cor: "#fff",
                        alinhamento do texto: "centro",
                        preenchimento: "0 20px",
                      }}
                    >
                      {nome.trim() || "Nome do evento"}
                    </span>
                  </div>
                  <div
                    estilo={{
                      preenchimento: "16px 18px",
                      fundo: "#fff",
                      exibir: "flex",
                      alignItems: "center",
                      justifyContent: "espaço-entre",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 13, color: "#9a8478" }}>Link público</p>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "#3a0a10" }}>
                        confirmei.com/{previewSlug}
                      </p>
                    </div>
                    <span
                      estilo={{
                        Tamanho da fonte: 11,
                        Peso da fonte: 600,
                        cor: "#b07d22",
                        fundo: "#f6ecda",
                        preenchimento: "5px 11px",
                        raioDaBorda: 100,
                      }}
                    >
                      Rascunho
                    </span>
                  </div>
                </div>

                {/* Resumo de créditos */}
                <div
                  estilo={{
                    exibir: "flex",
                    alignItems: "center",
                    justifyContent: "espaço-entre",
                    intervalo: 14,
                    fundo: "#faf6f0",
                    borda: "1px sólida #e6dccf",
                    borderRadius: 14,
                    preenchimento: "14px 17px",
                    margemInferior: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span
                      estilo={{
                        Tamanho da fonte: 11,5,
                        Peso da fonte: 600,
                        cor: formType === "qr" ? "#7a1b2a" : "#2f8f63",
                        background: formType === "qr" ? "#f4e7e0" : "#e6f1ea",
                        preenchimento: "5px 11px",
                        raioDaBorda: 100,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formType === "qr"? "Com QR Code" : "Sem QR Code"}
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

                {/* Cartão informativo */}
                <div
                  estilo={{
                    exibir: "flex",
                    alignItems: "flex-start",
                    intervalo: 12,
                    fundo: "#e6f1ea",
                    borda: "1px sólida #cfe5d8",
                    borderRadius: 14,
                    preenchimento: "15px 17px",
                  }}
                >
                  <Check size={19} color="#2f8f63" style={{ flexShrink: 0, marginTop: 1 }} strokeWidth={2} />
                  <p style={{ fontSize: 13, color: "#3a6b51", lineHeight: 1.45 }}>
                    Ao publicar, o link fica ativo na hora e você pode começar a se cadastrar e convidar seus convidados.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── NAVEGAÇÃO DE RODAPÉ ── */}
          <div
            estilo={{
              exibir: "flex",
              alignItems: "center",
              justifyContent: "espaço-entre",
              intervalo: 14,
              margemSuperior: 24,
            }}
          >
            {passo > 1 ? (
              <botão
                onClick={() => setStep((s) => s - 1)}
                estilo={{
                  exibir: "flex",
                  alignItems: "center",
                  intervalo: 8,
                  fundo: "#fff",
                  cor: "#5e3b32",
                  borda: "1px sólida #e6dccf",
                  borderRadius: 12,
                  preenchimento: "13px 22px",
                  fontFamily: "'Hanken Grotesk', sem serifa",
                  Tamanho da fonte: 14,5
                  Peso da fonte: 600,
                  cursor: "ponteiro",
                }}
              >
                <ArrowLeft size={17} />
                Voltar
              </button>
            ) : (
              <div />
            )}

            <div style={{ flex: 1 }} />

            {passo < 4 && (
              <botão
                onClick={() => setStep((s) => s + 1)}
                estilo={{
                  exibir: "flex",
                  alignItems: "center",
                  intervalo: 9,
                  fundo: "#4c0c14",
                  cor: "#fff",
                  fronteira: "nenhuma",
                  borderRadius: 12,
                  preenchimento: "13px 26px",
                  fontFamily: "'Hanken Grotesk', sem serifa",
                  Tamanho da fonte: 14,5
                  Peso da fonte: 600,
                  cursor: "ponteiro",
                  boxShadow: "0 10px 24px -10px rgba(76,12,20,0.6)",
                }}
              >
                Próximo
                <ArrowRight size={17} />
              </button>
            )}

            {passo === 4 && (
              <botão
                onClick={handlePublish}
                desativado={carregando}
                estilo={{
                  exibir: "flex",
                  alignItems: "center",
                  intervalo: 9,
                  fundo: "#2f8f63",
                  cor: "#fff",
                  fronteira: "nenhuma",
                  borderRadius: 12,
                  preenchimento: "13px 26px",
                  fontFamily: "'Hanken Grotesk', sem serifa",
                  Tamanho da fonte: 14,5
                  Peso da fonte: 600,
                  cursor: carregando ? "não permitido" : "ponteiro",
                  boxShadow: "0 10px 24px -10px rgba(47,143,99,0.6)",
                  opacidade: carregando ? 0,7 : 1,
                }}
              >
                {carregando ? (
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

      {/* Ocultar etiqueta do stepper móvel */}
      <style>{`
        @media (max-width: 680px) {
          .stepper-label { display: none !important; }
        }
        @keyframes spin { para { transform: rotate(360deg); } }
      ` estilo de cerveja>
    </div>
  );
}
