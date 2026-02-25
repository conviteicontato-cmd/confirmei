import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { LayoutDashboard, Calendar, LogOut, Users, QrCode, Settings, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface EventSidebarProps {
  user: User | null;
  eventName: string;
  eventId: string;
  activeTab: "convidados" | "checkin" | "configuracoes";
  onTabChange: (tab: "convidados" | "checkin" | "configuracoes") => void;
}

const SidebarContent = ({ 
  eventName, 
  activeTab, 
  onTabChange,
  onNavigate 
}: { 
  eventName: string;
  activeTab: string;
  onTabChange: (tab: "convidados" | "checkin" | "configuracoes") => void;
  onNavigate: (path: string) => void;
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

  const handleTabClick = (tab: "convidados" | "checkin" | "configuracoes") => {
    onTabChange(tab);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="font-display text-xl font-bold text-foreground">
          Organizador
        </h1>
        <p className="text-sm text-muted-foreground">Gestão de Eventos</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {/* Main nav */}
        <button
          onClick={() => onNavigate("/dashboard")}
          className="nav-item w-full"
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="font-medium">Painel</span>
        </button>
        <button
          onClick={() => onNavigate("/dashboard")}
          className="nav-item w-full"
        >
          <Calendar className="h-5 w-5" />
          <span className="font-medium">Eventos</span>
        </button>

        {/* Event context */}
        <div className="pt-6">
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="font-medium truncate">{eventName}</span>
          </div>
          
          <button
            onClick={() => handleTabClick("convidados")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ml-2",
              activeTab === "convidados"
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            <span>Convidados</span>
          </button>
          
          <button
            onClick={() => handleTabClick("checkin")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ml-2",
              activeTab === "checkin"
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <QrCode className="h-4 w-4" />
            <span>Check-in</span>
          </button>

          <button
            onClick={() => handleTabClick("configuracoes")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ml-2",
              activeTab === "configuracoes"
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            <span>Configurações</span>
          </button>
        </div>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
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

const EventSidebar = ({ user, eventName, eventId, activeTab, onTabChange }: EventSidebarProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleTabChange = (tab: "convidados" | "checkin" | "configuracoes") => {
    onTabChange(tab);
    setOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-bold text-foreground truncate">
              {eventName || "Evento"}
            </h1>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent 
                eventName={eventName}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                onNavigate={handleNavigate}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border flex-col h-screen sticky top-0">
        <SidebarContent 
          eventName={eventName}
          activeTab={activeTab}
          onTabChange={onTabChange}
          onNavigate={handleNavigate}
        />
      </aside>
    </>
  );
};

export default EventSidebar;
