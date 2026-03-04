import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, AlertTriangle, LogOut } from "lucide-react";
import CheckinPage from "@/components/event/CheckinPage";

type PageState = "loading" | "not_found" | "no_password" | "login" | "authenticated";

const SESSION_KEY = "checkin_session";

interface CheckinSession {
  event_id: string;
  event_name: string;
  token: string;
  expires_at: number;
  checkin_code: string;
}

const getStoredSession = (code: string): CheckinSession | null => {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY}_${code}`);
    if (!raw) return null;
    const session: CheckinSession = JSON.parse(raw);
    if (Date.now() > session.expires_at) {
      localStorage.removeItem(`${SESSION_KEY}_${code}`);
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

const PublicCheckin = () => {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<CheckinSession | null>(null);

  useEffect(() => {
    if (!code) {
      setState("not_found");
      return;
    }

    // Check existing session
    const stored = getStoredSession(code);
    if (stored) {
      setSession(stored);
      setState("authenticated");
      return;
    }

    // Verify the code exists
    const checkCode = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, checkin_code")
        .eq("checkin_code", code)
        .maybeSingle();

      if (error || !data) {
        setState("not_found");
        return;
      }

      // We can't read checkin_password from client (not in public view),
      // so we go straight to login screen. The edge function will tell us if no password is set.
      setState("login");
    };

    checkCode();
  }, [code]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !code) return;

    setSubmitting(true);
    setError("");

    try {
      const { data, error: fnError } = await supabase.functions.invoke("verify-checkin-password", {
        body: { checkin_code: code, password: password.trim() },
      });

      if (fnError) {
        // Try to parse the error from the response
        setError("Erro ao verificar senha. Tente novamente.");
        setSubmitting(false);
        return;
      }

      if (data?.error) {
        if (data.error.includes("Defina uma senha")) {
          setState("no_password");
        } else {
          setError(data.error);
        }
        setSubmitting(false);
        return;
      }

      if (data?.success) {
        const newSession: CheckinSession = {
          event_id: data.event_id,
          event_name: data.event_name,
          token: data.token,
          expires_at: data.expires_at,
          checkin_code: code,
        };
        localStorage.setItem(`${SESSION_KEY}_${code}`, JSON.stringify(newSession));
        setSession(newSession);
        setState("authenticated");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    if (code) {
      localStorage.removeItem(`${SESSION_KEY}_${code}`);
    }
    setSession(null);
    setPassword("");
    setError("");
    setState("login");
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
          <h1 className="text-xl font-bold text-foreground">Código de check-in inválido</h1>
          <p className="text-muted-foreground text-sm">
            O código informado não corresponde a nenhum evento.
          </p>
        </div>
      </div>
    );
  }

  if (state === "no_password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <Lock className="h-12 w-12 text-warning mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Check-in protegido</h1>
          <p className="text-muted-foreground text-sm">
            Defina uma senha de check-in nas configurações do evento para habilitar o acesso.
          </p>
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
            <h1 className="text-xl font-bold text-foreground">Check-in do Evento</h1>
            <p className="text-muted-foreground text-sm">
              Digite a senha para acessar o check-in
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-password">Senha</Label>
              <Input
                id="checkin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha do check-in"
                autoFocus
                className="input-elegant"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full btn-gold"
              disabled={submitting || !password.trim()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Entrar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated
  if (state === "authenticated" && session) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="font-bold text-foreground truncate">{session.event_name}</h2>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Sair
          </Button>
        </div>
        <CheckinPage eventId={session.event_id} eventName={session.event_name} />
      </div>
    );
  }

  return null;
};

export default PublicCheckin;
