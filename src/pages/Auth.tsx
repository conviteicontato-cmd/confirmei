import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowLeft } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";

type AuthMode = "login" | "signup" | "forgot_password";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSystemSettings();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // User has session — redirect to dashboard, guard there handles approval
        navigate("/dashboard");
      }
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
      toast({
        title: "E-mail enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
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
          options: {
            data: { full_name: fullName },
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
        } else if (data.user) {
          // Auto-confirmed, session created — redirect to dashboard
          // The dashboard guard will show "pending" screen if not approved
          toast({
            title: "Conta criada!",
            description: "Seu cadastro está aguardando aprovação do administrador.",
          });
          navigate("/dashboard");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Credenciais inválidas",
              description: "E-mail ou senha incorretos.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        } else if (data.user) {
          // Session created — redirect to dashboard, guard handles approval check
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
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

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
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
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
