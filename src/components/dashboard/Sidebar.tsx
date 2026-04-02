import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { LayoutDashboard, Calendar, LogOut, Menu, Shield, KeyRound } from "lucide-react";
import logo from "@/assets/Logotipo_Fundo_Tranparente.png";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAdminRole } from "@/hooks/useAdminRole";
import ChangePasswordModal from "./ChangePasswordModal";

interface SidebarProps {
  user: User | null;
  activeSection?: "painel" | "eventos";
}

const SidebarContent = ({ 
  activeSection, 
  onNavigate,
  isSuperAdmin,
  onChangePassword,
}: { 
  activeSection: string; 
  onNavigate: (path: string) => void;
  isSuperAdmin: boolean;
  onChangePassword?: () => void;
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
    { id: "painel" as const, label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
    { id: "eventos" as const, label: "Eventos", icon: Calendar, path: "/dashboard" },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="font-display text-xl font-bold" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
          Organizador
        </h1>
        <p className="text-sm" style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)' }}>Gestão de Eventos</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className={cn(
              activeSection === item.id ? "nav-item-active" : "nav-item",
              "w-full"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
        
        {isSuperAdmin && (
          <button
            onClick={() => onNavigate("/admin")}
            className="nav-item w-full mt-4"
          >
            <Shield className="h-5 w-5" />
            <span className="font-medium">Admin Panel</span>
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => onChangePassword?.()}
          className="nav-item w-full text-muted-foreground"
        >
          <KeyRound className="h-5 w-5" />
          <span className="font-medium">Alterar Senha</span>
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

const Sidebar = ({ user, activeSection = "painel" }: SidebarProps) => {
  const [open, setOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const navigate = useNavigate();
  const { isSuperAdmin } = useAdminRole(user);

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleChangePassword = () => {
    setOpen(false);
    setChangePasswordOpen(true);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between p-4">
          <h1 className="font-display text-lg font-bold" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
            Organizador
          </h1>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="min-w-[44px] min-h-[44px]" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar">
              <SidebarContent 
                activeSection={activeSection} 
                onNavigate={handleNavigate}
                isSuperAdmin={isSuperAdmin}
                onChangePassword={handleChangePassword}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border flex-col h-screen sticky top-0">
        <SidebarContent 
          activeSection={activeSection} 
          onNavigate={handleNavigate}
          isSuperAdmin={isSuperAdmin}
          onChangePassword={handleChangePassword}
        />
      </aside>

      <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
};

export default Sidebar;
