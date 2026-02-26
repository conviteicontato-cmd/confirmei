import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, Loader2, Clock, XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";

type AuthMode = "login" | "signup" | "forgot_password";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSystemSettings();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status, rejection_reason")
          .eq("user_id", session.user.id)
          .single();

        if (profile?.status === "approved") {
          navigate("/dashboard");
        } else {
          // Non-approved users: redirect to dashboard which shows the blocking screen
          // Session stays active so the user doesn't get stuck in a loop
          navigate("/dashboard");
        }
      }
    });
  }, [navigate]);

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unconfirmedEmail,
      });
      if (error) throw error;
      toast({
        title: "E-mail reenviado!",
        description: "Verifique sua caixa de entrada e spam.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao reenviar e-mail.";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setResendingEmail(false);
    }
  };

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
      toast({
        title: "E-mail enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao enviar e-mail.";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPendingApproval(false);
    setRejected(false);
    setEmailNotConfirmed(false);

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
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "E-mail já cadastrado",
              description: "Este e-mail já está em uso. Tente fazer login.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        } else {
          if (settings.require_approval) {
            toast({
              title: "Conta criada!",
              description: "Verifique seu e-mail e aguarde a aprovação do administrador.",
            });
            setPendingApproval(true);
          } else {
            toast({
              title: "Conta criada!",
              description: "Verifique seu e-mail para confirmar o cadastro.",
            });
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Email not confirmed")) {
            setEmailNotConfirmed(true);
            setUnconfirmedEmail(email);
            toast({
              title: "E-mail não confirmado",
              description: "Confirme seu e-mail antes de fazer login. Use o botão abaixo para reenviar.",
              variant: "destructive",
            });
          } else if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Credenciais inválidas",
              description: "E-mail ou senha incorretos. Verifique seus dados e tente novamente.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        } else if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("status, rejection_reason")
            .eq("user_id", data.user.id)
            .single();

          if (profile?.status === "pending") {
            setPendingApproval(true);
            await supabase.auth.signOut();
            toast({
              title: "Aguardando aprovação",
              description: "Seu cadastro está sendo analisado pelo administrador.",
            });
          } else if (profile?.status === "rejected") {
            setRejected(true);
            setRejectionReason(profile.rejection_reason);
            await supabase.auth.signOut();
          } else {
            toast({
              title: "Login realizado!",
              description: "Bem-vindo de volta!",
            });
            navigate("/dashboard");
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Algo deu errado. Tente novamente.";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (pendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center animate-slide-up">
          <div className="card-elegant p-8 space-y-6">
            <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Aguardando Aprovação
            </h1>
            <p className="text-muted-foreground">
              Seu cadastro foi recebido e está sendo analisado pelo administrador.
              Você receberá uma notificação quando for aprovado.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setPendingApproval(false);
                setMode("login");
              }}
              className="w-full"
            >
              Voltar ao Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center animate-slide-up">
          <div className="card-elegant p-8 space-y-6">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Cadastro Não Aprovado
            </h1>
            <p className="text-muted-foreground">
              Infelizmente seu cadastro não foi aprovado pelo administrador.
            </p>
            {rejectionReason && (
              <div className="bg-muted rounded-lg p-4 text-left">
                <p className="text-sm font-medium text-foreground">Motivo:</p>
                <p className="text-sm text-muted-foreground mt-1">{rejectionReason}</p>
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setRejected(false);
                setMode("login");
              }}
              className="w-full"
            >
              Voltar ao Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password mode
  if (mode === "forgot_password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-bold text-foreground mb-2">
              Esqueci minha senha
            </h1>
            <p className="text-muted-foreground">
              {forgotPasswordSent
                ? "Verifique sua caixa de entrada"
                : "Informe seu e-mail para redefinir sua senha"}
            </p>
          </div>

          <div className="card-elegant p-8">
            {forgotPasswordSent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Mail className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-muted-foreground">
                  Um link de redefinição foi enviado para <strong>{email}</strong>.
                  Verifique também sua pasta de spam.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setForgotPasswordSent(false);
                    setMode("login");
                  }}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 input-elegant"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-gold h-12 rounded-full text-base"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Enviar link de redefinição"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode("login")}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar ao Login
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            Área do Organizador
          </h1>
          <p className="text-muted-foreground">
            {mode === "login"
              ? "Entre para gerenciar seus eventos"
              : "Crie sua conta para começar"}
          </p>
        </div>

        <div className="card-elegant p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="pl-10 input-elegant"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 input-elegant"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Senha</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot_password")}
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10 pr-10 input-elegant"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Resend confirmation email button */}
            {emailNotConfirmed && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-yellow-800">
                  Seu e-mail ainda não foi confirmado. Clique abaixo para reenviar o e-mail de confirmação.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail}
                  className="w-full border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                >
                  {resendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reenviar e-mail de confirmação
                </Button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (mode === "signup" && !settings.registration_enabled)}
              className="w-full btn-gold h-12 rounded-full text-base"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar conta"
              )}
            </Button>

            {mode === "signup" && !settings.registration_enabled && (
              <p className="text-sm text-center text-yellow-600">
                Novos cadastros estão temporariamente desabilitados
              </p>
            )}
          </form>
        </div>

        <p className="text-center mt-6 text-muted-foreground">
          {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setEmailNotConfirmed(false);
            }}
            className="text-primary hover:underline font-medium"
          >
            {mode === "login" ? "Criar conta" : "Fazer login"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
