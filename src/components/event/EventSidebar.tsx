import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Heart,
  Users,
  QrCode,
  BarChart3,
  MessageSquare,
  Settings,
  LogOut,
  KeyRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChangePasswordModal from "@/components/dashboard/ChangePasswordModal";

type EventTab = "convidados" | "checkin" | "dashboard" | "configuracoes" | "mensagens";

interface EventSidebarProps {
  user: User | null;
  eventName: string;
  eventDate?: string | null;
  eventId: string;
  activeTab: EventTab;
  onTabChange: (tab: EventTab) => void;
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatShortDate = (date?: string | null) => {
  if (!date) return "";
  const d = new Date(date.includes("T") ? date : date + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
};

const navItems: { id: EventTab; label: string; icon: typeof Users }[] = [
  { id: "convidados", label: "Convidados", icon: Users },
  { id: "checkin", label: "Check-in", icon: QrCode },
  { id: "dashboard", label: "Dashboard ao vivo", icon: BarChart3 },
  { id: "mensagens", label: "Mensagens", icon: MessageSquare },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

const EventSidebar = ({ user, eventName, eventDate, activeTab, onTabChange }: EventSidebarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfileName(data?.full_name || data?.email || user.email || "Organizador");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  const displayName = profileName || user?.email || "Organizador";
  const initials = getInitials(displayName);
  const shortDate = formatShortDate(eventDate);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logout realizado", description: "Até logo!" });
    navigate("/auth");
  };

  return (
    <>
      {/* ============ DESKTOP SIDEBAR ============ */}
      <aside className="hidden md:flex w-[262px] flex-none flex-col sticky top-0 h-screen bg-gradient-to-b from-[#4c0c14] to-[#3c080f] text-[#f4eee5]">
        <div className="px-[26px] pt-7 pb-5 flex items-center gap-[11px]">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-[#f4eee5] flex items-center justify-center flex-none">
            <span className="font-serif font-bold text-2xl text-[#4c0c14] leading-none">C</span>
          </div>
          <span className="font-serif font-semibold text-[27px] tracking-[0.3px] text-[#f4eee5]">
            Confirmei
          </span>
        </div>

        <div className="px-4 pt-1">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full flex items-center gap-[13px] px-[13px] py-[10px] rounded-[11px] text-left text-[14px] font-medium text-[#f4eee5]/60 hover:bg-[#f4eee5]/[0.06] hover:text-[#f4eee5] transition-colors"
          >
            <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={1.8} />
            Voltar ao painel
          </button>
        </div>

        {/* event context */}
        <div className="mx-4 mt-[14px] pt-4 border-t border-[#f4eee5]/[0.12]">
          <div className="flex items-center gap-[10px] px-1 pb-3">
            <div className="w-8 h-8 rounded-lg flex-none flex items-center justify-center bg-gradient-to-br from-[#7a1b2a] to-[#a83f57]">
              <Heart className="w-4 h-4 text-white" strokeWidth={1.9} />
            </div>
            <div className="min-w-0">
              <p className="font-serif font-semibold text-[17px] text-[#f4eee5] leading-[1.1] truncate">
                {eventName || "Evento"}
              </p>
              {shortDate && (
                <p className="text-[11px] text-[#f4eee5]/50">{shortDate}</p>
              )}
            </div>
          </div>

          <p className="text-[10.5px] font-semibold tracking-[1.4px] uppercase text-[#f4eee5]/[0.42] px-[6px] pt-[6px] pb-2">
            Gestão
          </p>

          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`relative w-full flex items-center gap-3 px-[13px] py-[10px] rounded-[11px] text-left text-[14px] mb-[3px] transition-colors ${
                  active
                    ? "bg-[#f4eee5]/10 text-white font-semibold"
                    : "text-[#f4eee5]/[0.72] font-medium hover:bg-[#f4eee5]/[0.06] hover:text-[#f4eee5]"
                }`}
              >
                {active && (
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-[3px] bg-[#ef86aa]" />
                )}
                <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-auto p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-[11px] p-[11px] rounded-[13px] bg-[#f4eee5]/[0.07] hover:bg-[#f4eee5]/[0.12] transition-colors">
                <div
                  className="w-[38px] h-[38px] rounded-full flex-none flex items-center justify-center font-semibold text-[14px] text-white bg-gradient-to-br from-[#7a1b2a] to-[#b34a63]"
                  style={{ boxShadow: "0 0 0 2px #ef86aa, 0 0 0 4px rgba(244,238,229,.12)" }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[13px] font-semibold text-[#f4eee5] truncate">{displayName}</p>
                  <p className="text-[11px] text-[#f4eee5]/50">Organizadora</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56">
              <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                <KeyRound className="h-4 w-4 mr-2" />
                Alterar senha
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ============ MOBILE BOTTOM NAV ============ */}
      <nav
        className="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e6dccf] px-[6px] pt-2 flex shadow-[0_-8px_24px_-14px_rgba(46,12,16,.35)]"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex-1 flex flex-col items-center gap-[3px] py-[3px] ${
                active ? "text-[#7a1b2a]" : "text-[#ab9b8d]"
              }`}
            >
              <item.icon className="w-[21px] h-[21px]" strokeWidth={1.8} />
              <span className="text-[9.5px] font-semibold">{item.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </nav>

      <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
};

export default EventSidebar;
