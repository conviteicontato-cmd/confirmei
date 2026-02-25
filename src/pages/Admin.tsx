import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { useAdminRole } from "@/hooks/useAdminRole";
import { Loader2, Shield } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminUsers from "@/components/admin/AdminUsers";
import AdminEvents from "@/components/admin/AdminEvents";
import AdminAuditLogs from "@/components/admin/AdminAuditLogs";
import AdminSettings from "@/components/admin/AdminSettings";

type AdminTab = "dashboard" | "users" | "events" | "audit" | "settings";

const Admin = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const navigate = useNavigate();
  const { isSuperAdmin, loading: roleLoading } = useAdminRole(user);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Shield className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground text-center mb-6">
          Você não tem permissão para acessar esta área.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="btn-gold px-6 py-2 rounded-lg"
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const renderContent = () => {
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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <AdminSidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        user={user}
      />
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        {renderContent()}
      </main>
    </div>
  );
};

export default Admin;
