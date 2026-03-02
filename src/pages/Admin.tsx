import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminEvents from "@/components/admin/AdminEvents";
import AdminAuditLogs from "@/components/admin/AdminAuditLogs";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminErrorBoundary from "@/components/admin/AdminErrorBoundary";

type AdminTab = "dashboard" | "users" | "events" | "audit" | "settings";

const AdminContentSkeleton = () => (
  <div className="p-6 lg:p-8 space-y-6">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-4 w-96 max-w-full" />
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
    <Skeleton className="h-80 w-full" />
  </div>
);

const Admin = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useAdminRole(user);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession((prev) => {
        const prevUserId = prev?.user?.id;
        const nextUserId = nextSession?.user?.id;
        if (prevUserId === nextUserId && !!prev?.access_token && !!nextSession?.access_token) {
          return prev;
        }
        return nextSession;
      });

      setUser((prev) => {
        const nextUser = nextSession?.user ?? null;
        if (prev?.id === nextUser?.id) return prev;
        return nextUser;
      });

      if (!nextSession) {
        navigate("/auth");
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!mounted) return;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setAuthLoading(false);

        if (!initialSession) {
          navigate("/auth");
        }
      })
      .catch((error) => {
        console.error("Error loading admin session:", error);
        if (!mounted) return;
        setAuthLoading(false);
        navigate("/auth");
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const renderContent = () => {
    if (roleLoading) {
      return <AdminContentSkeleton />;
    }

    if (!isSuperAdmin) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center bg-background p-4">
          <Shield className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground text-center mb-6">
            Você não tem permissão para acessar esta área.
          </p>
          <Button onClick={() => navigate("/dashboard")}>Voltar ao Dashboard</Button>
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard":
        return <AdminDashboard onTabChange={setActiveTab} />;
      case "users":
        return <AdminUsers />;
      case "events":
        return <AdminEvents />;
      case "audit":
        return <AdminAuditLogs />;
      case "settings":
        return <AdminSettings />;
      default:
        return <AdminDashboard onTabChange={setActiveTab} />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AdminErrorBoundary>
      <div className="min-h-screen flex flex-col lg:flex-row bg-background">
        {(isSuperAdmin || roleLoading) && (
          <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} user={user} />
        )}
        <main className={`flex-1 overflow-auto ${isSuperAdmin || roleLoading ? "pt-16 lg:pt-0" : ""}`}>
          {renderContent()}
        </main>
      </div>
    </AdminErrorBoundary>
  );
};

export default Admin;
