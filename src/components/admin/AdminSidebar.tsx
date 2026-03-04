import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  Shield,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

type AdminTab = "dashboard" | "users" | "events" | "audit" | "settings";

interface AdminSidebarProps {
  user: User | null;
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

interface PendingCount {
  count: number;
}

const SidebarContent = ({ 
  activeTab, 
  onTabChange,
  pendingCount,
}: { 
  activeTab: AdminTab; 
  onTabChange: (tab: AdminTab) => void;
  pendingCount: number;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Até logo!",
    });
    navigate("/auth");
  };

  const navItems = [
    { id: "dashboard" as AdminTab, label: "Dashboard", icon: LayoutDashboard },
    { id: "users" as AdminTab, label: "Usuários", icon: Users, badge: pendingCount },
    { id: "events" as AdminTab, label: "Eventos", icon: Calendar },
    { id: "audit" as AdminTab, label: "Auditoria", icon: FileText },
    { id: "settings" as AdminTab, label: "Configurações", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" style={{ color: 'hsl(var(--sidebar-foreground))' }} />
          <div>
            <h1 className="font-display text-xl font-bold" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
              Admin Panel
            </h1>
            <p className="text-sm" style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)' }}>Super Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              activeTab === item.id ? "nav-item-active" : "nav-item",
              "w-full justify-between"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5" />
              <span className="font-medium">{item.label}</span>
            </div>
            {item.badge && item.badge > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => navigate("/dashboard")}
          className="nav-item w-full text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="font-medium">Área do Organizador</span>
        </button>
        <button
          onClick={handleLogout}
          className="nav-item w-full text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
};

const AdminSidebar = ({ user, activeTab, onTabChange }: AdminSidebarProps) => {
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function fetchPendingCount() {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      
      setPendingCount(count || 0);
    }

    fetchPendingCount();

    // Subscribe to changes
    const channel = supabase
      .channel("pending-users")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleTabChange = (tab: AdminTab) => {
    onTabChange(tab);
    setOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" style={{ color: 'hsl(var(--sidebar-foreground))' }} />
            <h1 className="font-display text-lg font-bold" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
              Admin Panel
            </h1>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative min-w-[44px] min-h-[44px]" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
                <Menu className="h-5 w-5" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar">
              <SidebarContent 
                activeTab={activeTab} 
                onTabChange={handleTabChange}
                pendingCount={pendingCount}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border flex-col h-screen sticky top-0">
        <SidebarContent 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          pendingCount={pendingCount}
        />
      </aside>
    </>
  );
};

export default AdminSidebar;
