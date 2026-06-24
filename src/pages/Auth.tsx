import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  MessageCircle,
  QrCode,
  LineChart,
  Heart,
} from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";

type AuthMode = "login" | "signup" | "forgot_password";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
  </svg>
);

const FieldShell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-[10px] bg-white border border-[#e6dccf] rounded-[12px] px-[14px] py-3 transition-colors focus-within:border-[#7a1b2a]">
    {children}
  </div>
);

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSystemSettings();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotPasswordSent(true);
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir sua senha." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao enviar e-mail.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!settings.registration_enabled) {
          toast({
            title: "Cadastros desabilitados",
            description: "No momento, não é possível criar novas contas.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "E-mail já cadastrado",
              description: "Este e-mail já está em uso. Tente fazer login.",
              variant: "destructive",
            });
          } else throw error;
        } else if (data.user) {
          toast({ title: "Conta criada!", description: "Seu cadastro está aguardando aprovação do administrador." });
          navigate("/dashboard");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({ title: "Credenciais inválidas", description: "E-mail ou senha incorretos.", variant: "destructive" });
          } else throw error;
        } else if (data.user) {
          navigate("/dashboard");
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Algo deu errado. Tente novamente.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível entrar com o Google.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    }
  };

  const isLogin = mode === "login";
  const isSignup = mode === "signup";

  const tabClass = (active: boolean) =>
    `flex-1 cursor-pointer text-sm font-semibold py-[10px] rounded-[9px] transition-colors ${
      active ? "bg-[#4c0c14] text-white" : "bg-transparent text-[#9a8478]"
    }`;

  return (
    <div className="flex min-h-screen w-full bg-[#f4eee5] font-grotesk text-[#3a0a10]">
      {/* ============ BRAND PANEL ============ */}
      <aside className="hidden min-[820px]:flex w-[46%] max-w-[660px] flex-none relative overflow-hidden flex-col p-12 px-14 text-[#f4eee5] bg-[linear-gradient(155deg,#4c0c14_0%,#6e1726_52%,#a83f57_100%)]">
        <div className="absolute -top-[140px] -right-[120px] w-[380px] h-[380px] rounded-full border border-[#f4eee5]/[0.12]" />
        <div className="absolute -top-[90px] -right-[70px] w-[280px] h-[280px] rounded-full border border-[#f4eee5]/[0.10]" />
        <div className="absolute -bottom-[160px] -left-[120px] w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(239,134,170,.16),transparent_68%)]" />

        <div className="flex items-center gap-3 relative">
          <div className="w-10 h-10 rounded-[11px] bg-[#f4eee5] flex items-center justify-center flex-none">
            <span className="font-serif font-bold text-[28px] text-[#4c0c14] leading-none">C</span>
          </div>
          <span className="font-serif font-semibold text-[31px] tracking-[0.3px] text-[#f4eee5]">Confirmei</span>
        </div>

        <div className="mt-auto relative">
          <div className="inline-flex items-center gap-[7px] bg-[#f4eee5]/[0.12] border border-[#f4eee5]/[0.22] rounded-full px-[14px] py-[6px] mb-6">
            <span className="w-[7px] h-[7px] rounded-full bg-[#ef86aa] animate-pulse-dot" />
            <span className="text-[11px] font-semibold tracking-[1.4px] uppercase text-[#f4eee5]">
              Gestão de confirmações
            </span>
          </div>
          <h1 className="font-serif font-semibold text-[46px] leading-[1.08] text-white tracking-[0.2px]">
            Cada confirmação,<br />no lugar certo.
          </h1>
          <p className="text-[16px] leading-[1.55] text-[#f4eee5]/[0.78] mt-[18px] max-w-[430px]">
            Convites, RSVP por WhatsApp, QR Code na portaria e um painel ao vivo — tudo num só lugar para o grande dia sair perfeito.
          </p>
        </div>

        <div className="flex flex-wrap gap-[10px] mt-[30px] relative">
          {[
            { icon: MessageCircle, label: "RSVP por WhatsApp" },
            { icon: QrCode, label: "Check-in com QR Code" },
            { icon: LineChart, label: "Painel ao vivo" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2 bg-[#f4eee5]/[0.08] border border-[#f4eee5]/[0.14] rounded-[12px] px-[14px] py-[9px]"
            >
              <f.icon className="w-4 h-4 text-[#ef86aa]" strokeWidth={1.9} />
              <span className="text-[13px] font-medium text-[#f4eee5]">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-[14px] mt-[34px] pt-[26px] border-t border-[#f4eee5]/[0.14] relative">
          <div className="flex">
            <span className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#7a1b2a,#b34a63)] border-2 border-[#6e1726] flex items-center justify-center text-[11px] font-semibold text-white">AL</span>
            <span className="w-8 h-8 rounded-full -ml-[9px] bg-[linear-gradient(135deg,#a83f57,#ef86aa)] border-2 border-[#6e1726] flex items-center justify-center text-[11px] font-semibold text-white">RM</span>
            <span className="w-8 h-8 rounded-full -ml-[9px] bg-[linear-gradient(135deg,#6b4d8a,#9a7bc0)] border-2 border-[#6e1726] flex items-center justify-center text-[11px] font-semibold text-white">JS</span>
            <span className="w-8 h-8 rounded-full -ml-[9px] bg-[#f4eee5]/[0.16] border-2 border-[#6e1726] flex items-center justify-center text-[10.5px] font-semibold text-[#f4eee5]">+2k</span>
          </div>
          <p className="text-[13px] text-[#f4eee5]/[0.74] leading-[1.4]">
            Mais de <b className="text-white">2.400 eventos</b><br />já organizados com o Confirmei
          </p>
        </div>
      </aside>

      {/* ============ FORM PANEL ============ */}
      <main className="flex-1 min-w-0 flex items-center justify-center p-10 px-8">
        <div className="w-full max-w-[392px]">
          {mode === "forgot_password" ? (
            <div className="animate-[float-in_0.4s_ease-out]">
              <div className="mb-6">
                <h2 className="font-serif font-semibold text-[32px] leading-[1.1] text-[#3a0a10]">
                  Esqueci a senha
                </h2>
                <p className="text-sm text-[#9a8478] mt-[5px]">
                  {forgotPasswordSent
                    ? "Verifique sua caixa de entrada para continuar."
                    : "Informe seu e-mail para receber o link de redefinição."}
                </p>
              </div>

              {forgotPasswordSent ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 bg-[#e6f1ea] border border-[#cfe6da] rounded-[12px] px-4 py-4">
                    <Mail className="h-6 w-6 text-[#2f8f63] flex-none" />
                    <p className="text-[13.5px] text-[#3a0a10]">
                      Um link foi enviado para <strong>{email}</strong>. Verifique também o spam.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setForgotPasswordSent(false);
                      setMode("login");
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-white text-[#4c0c14] border border-[#e6dccf] rounded-[12px] py-[13px] text-sm font-semibold hover:bg-[#fbf7f1] transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-[18px]">
                  <div>
                    <label className="text-[12.5px] font-semibold text-[#7a6258] mb-2 block">E-mail</label>
                    <FieldShell>
                      <Mail className="w-[17px] h-[17px] text-[#b3a194] flex-none" strokeWidth={1.8} />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@email.com"
                        className="flex-1 border-none outline-none bg-transparent text-[14.5px] text-[#3a0a10]"
                      />
                    </FieldShell>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-[9px] bg-[#4c0c14] text-white rounded-[12px] py-[14px] text-[15px] font-semibold hover:bg-[#5e1019] transition-colors disabled:opacity-60 shadow-[0_10px_24px_-10px_rgba(76,12,20,.6)]"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar link de redefinição"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full flex items-center justify-center gap-2 text-[13.5px] font-semibold text-[#7a1b2a] hover:underline"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para o login
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
              {/* tab switch */}
              <div className="flex items-center gap-[6px] bg-white border border-[#e6dccf] rounded-[13px] p-[5px] mb-[30px]">
                <button onClick={() => setMode("login")} className={tabClass(isLogin)}>Entrar</button>
                <button onClick={() => setMode("signup")} className={tabClass(isSignup)}>Criar conta</button>
              </div>

              <div className="mb-1">
                <h2 className="font-serif font-semibold text-[32px] leading-[1.1] text-[#3a0a10]">
                  {isLogin ? "Bem-vinda de volta" : "Crie sua conta"}
                </h2>
                <p className="text-sm text-[#9a8478] mt-[5px]">
                  {isLogin
                    ? "Acesse o painel para gerenciar seus eventos."
                    : "Comece a organizar confirmações em minutos."}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                {isSignup && (
                  <div className="mt-6">
                    <label className="text-[12.5px] font-semibold text-[#7a6258] mb-2 block">Nome completo</label>
                    <FieldShell>
                      <User className="w-[17px] h-[17px] text-[#b3a194] flex-none" strokeWidth={1.8} />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Marina Alves"
                        className="flex-1 border-none outline-none bg-transparent text-[14.5px] text-[#3a0a10]"
                      />
                    </FieldShell>
                  </div>
                )}

                <div className="mt-[18px]">
                  <label className="text-[12.5px] font-semibold text-[#7a6258] mb-2 block">E-mail</label>
                  <FieldShell>
                    <Mail className="w-[17px] h-[17px] text-[#b3a194] flex-none" strokeWidth={1.8} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                      className="flex-1 border-none outline-none bg-transparent text-[14.5px] text-[#3a0a10]"
                    />
                  </FieldShell>
                </div>

                <div className="mt-[18px]">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[12.5px] font-semibold text-[#7a6258]">Senha</label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot_password")}
                        className="text-[12.5px] font-semibold text-[#7a1b2a] hover:underline"
                      >
                        Esqueci a senha
                      </button>
                    )}
                  </div>
                  <FieldShell>
                    <Lock className="w-[17px] h-[17px] text-[#b3a194] flex-none" strokeWidth={1.8} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="flex-1 border-none outline-none bg-transparent text-[14.5px] text-[#3a0a10]"
                    />
                    <button type="button" onClick={() => setShowPassword((s) => !s)} className="text-[#b3a194] hover:text-[#7a6258]">
                      {showPassword ? <EyeOff className="w-[17px] h-[17px]" strokeWidth={1.8} /> : <Eye className="w-[17px] h-[17px]" strokeWidth={1.8} />}
                    </button>
                  </FieldShell>
                </div>

                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setRemember((r) => !r)}
                    className="flex items-center gap-[9px] mt-4"
                  >
                    <span
                      className={`w-[19px] h-[19px] rounded-[6px] flex items-center justify-center flex-none border ${
                        remember ? "bg-[#4c0c14] border-[#4c0c14]" : "bg-white border-[#d9ccbe]"
                      }`}
                    >
                      {remember && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="text-[13.5px] text-[#5e4b40]">Manter conectado neste dispositivo</span>
                  </button>
                )}

                {isSignup && (
                  <button
                    type="button"
                    onClick={() => setAgreedTerms((t) => !t)}
                    className="flex items-start gap-[9px] mt-[18px] text-left"
                  >
                    <span
                      className={`w-[19px] h-[19px] rounded-[6px] flex items-center justify-center flex-none mt-[1px] border ${
                        agreedTerms ? "bg-[#4c0c14] border-[#4c0c14]" : "bg-white border-[#d9ccbe]"
                      }`}
                    >
                      {agreedTerms && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className="text-[13px] text-[#7a6258] leading-[1.45]">
                      Li e concordo com os <b className="text-[#7a1b2a]">Termos de uso</b> e a{" "}
                      <b className="text-[#7a1b2a]">Política de privacidade</b>.
                    </span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={loading || (isSignup && (!settings.registration_enabled || !agreedTerms))}
                  className="w-full flex items-center justify-center gap-[9px] bg-[#4c0c14] text-white rounded-[12px] py-[14px] text-[15px] font-semibold mt-6 hover:bg-[#5e1019] transition-colors disabled:opacity-60 shadow-[0_10px_24px_-10px_rgba(76,12,20,.6)]"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      {isLogin ? "Entrar no painel" : "Criar minha conta"}
                      <ArrowRight className="w-[17px] h-[17px]" strokeWidth={2} />
                    </>
                  )}
                </button>

                {isSignup && !settings.registration_enabled && (
                  <p className="text-[12.5px] text-center text-[#b07d22] mt-3">
                    Novos cadastros estão temporariamente desabilitados.
                  </p>
                )}
              </form>

              <div className="flex items-center gap-[14px] my-[22px]">
                <span className="flex-1 h-px bg-[#e6dccf]" />
                <span className="text-[12px] text-[#b3a194]">ou continue com</span>
                <span className="flex-1 h-px bg-[#e6dccf]" />
              </div>

              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-[10px] bg-white text-[#3a0a10] border border-[#e6dccf] rounded-[12px] py-3 text-sm font-semibold hover:bg-[#fbf7f1] transition-colors"
              >
                <GoogleIcon />
                Continuar com Google
              </button>

              <p className="text-center text-[13px] text-[#9a8478] mt-[26px]">
                {isLogin ? "Ainda não tem conta? " : "Já tem uma conta? "}
                <b
                  onClick={() => setMode(isLogin ? "signup" : "login")}
                  className="text-[#7a1b2a] cursor-pointer hover:underline"
                >
                  {isLogin ? "Criar conta gratuita" : "Entrar"}
                </b>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Auth;
