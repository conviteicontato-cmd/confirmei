import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Calendar,
  LogOut,
  Shield,
  KeyRound,
  Plus,
  UserRound,
} from "lucide-react";
import logo from "@/assets/Logotipo_Fundo_Tranparente.png";
import { useToast } from "@/hooks/use-toast";
import { useAdminRole } from "@/hooks/useAdminRole";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChangePasswordModal from "./ChangePasswordModal";

interface SidebarProps {
  user: User | null;
  activeSection?: "painel" | "eventos";
}

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "OR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Sidebar = ({ user, activeSection = "painel" }: SidebarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useAdminRole(user);
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
  const role = isSuperAdmin ? "Super-admin · Organizador" : "Organizador(a)";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logout realizado", description: "Até logo!" });
    navigate("/auth");
  };

  const navItems = [
    { id: "painel" as const, label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
    { id: "eventos" as const, label: "Eventos", icon: Calendar, path: "/dashboard" },
  ];

  return (
    <>
      {/* ============ DESKTOP SIDEBAR ============ */}
      <aside className="hidden md:flex w-[260px] flex-none flex-col sticky top-0 h-screen bg-gradient-to-b from-[#4c0c14] to-[#3c080f] text-[#f4eee5]">
        <div className="px-[26px] pt-[30px] pb-6 flex items-center gap-[11px]">
          <div className="w-[34px] h-[34px] rounded-[9px] bg-[#f4eee5] flex items-center justify-center flex-none">
            <span className="font-serif font-bold text-2xl text-[#4c0c14] leading-none">C</span>
          </div>
          <span className="font-serif font-semibold text-[27px] tracking-[0.3px] text-[#f4eee5]">
            Confirmei
          </span>
        </div>

        <div className="px-4 pt-[6px]">
          <p className="text-[10.5px] font-semibold tracking-[1.4px] uppercase text-[#f4eee5]/[0.42] px-3 pt-[14px] pb-2">
            Menu
          </p>

          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`relative w-full flex items-center gap-[13px] px-[13px] py-[11px] rounded-[11px] text-left text-[14.5px] mb-[3px] transition-colors ${
                  active
                    ? "bg-[#f4eee5]/10 text-white font-semibold"
                    : "text-[#f4eee5]/[0.72] font-medium hover:bg-[#f4eee5]/[0.06] hover:text-[#f4eee5]"
                }`}
              >
                {active && (
                  <span className="absolute -left-4 top-1/2 -translate-y-1/2 w-[3px] h-[22px] rounded-r-[3px] bg-[#ef86aa]" />
                )}
                <item.icon className="w-[19px] h-[19px]" strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}

          {isSuperAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-[13px] px-[13px] py-[11px] rounded-[11px] text-left text-[14.5px] mb-[3px] text-[#f4eee5]/[0.72] font-medium hover:bg-[#f4eee5]/[0.06] hover:text-[#f4eee5] transition-colors"
            >
              <Shield className="w-[19px] h-[19px]" strokeWidth={1.8} />
              Admin
            </button>
          )}
        </div>

        <div className="mt-auto p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-[11px] p-[11px] rounded-[13px] bg-[#f4eee5]/[0.07] hover:bg-[#f4eee5]/[0.12] transition-colors">
                <div
                  className="w-10 h-10 rounded-full flex-none flex items-center justify-center font-semibold text-[15px] text-white bg-gradient-to-br from-[#7a1b2a] to-[#b34a63]"
                  style={{ boxShadow: "0 0 0 2px #ef86aa, 0 0 0 4px rgba(244,238,229,.12)" }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[13.5px] font-semibold text-[#f4eee5] truncate">
                    {displayName}
                  </p>
                  <p className="text-[11.5px] text-[#f4eee5]/50">{role}</p>
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
      <nav className="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e6dccf] px-[6px] pt-2 flex shadow-[0_-8px_24px_-14px_rgba(46,12,16,.35)]"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => navigate("/dashboard")}
          className="flex-1 flex flex-col items-center gap-[3px] py-[3px] text-[#7a1b2a]"
        >
          <LayoutDashboard className="w-[22px] h-[22px]" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">Painel</span>
        </button>
        <button
          onClick={() => navigate("/dashboard")}
          className="flex-1 flex flex-col items-center gap-[3px] py-[3px] text-[#ab9b8d]"
        >
          <Calendar className="w-[22px] h-[22px]" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">Eventos</span>
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-new-event"))}
          className="flex-1 flex flex-col items-center gap-1 text-[#7a1b2a]"
        >
          <span className="w-[46px] h-[34px] -mt-[2px] rounded-[11px] bg-[#4c0c14] flex items-center justify-center shadow-[0_6px_14px_-5px_rgba(76,12,20,.7)]">
            <Plus className="w-5 h-5 text-white" strokeWidth={2.4} />
          </span>
          <span className="text-[10px] font-semibold">Novo</span>
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className="flex-1 flex flex-col items-center gap-[3px] py-[3px] text-[#ab9b8d]"
          >
            <Shield className="w-[22px] h-[22px]" strokeWidth={1.8} />
            <span className="text-[10px] font-semibold">Admin</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center gap-[3px] py-[3px] text-[#ab9b8d]"
        >
          <UserRound className="w-[22px] h-[22px]" strokeWidth={1.8} />
          <span className="text-[10px] font-semibold">Sair</span>
        </button>
      </nav>

      <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
};

export default Sidebar;
