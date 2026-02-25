import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Settings, Plus } from "lucide-react";
import AdjustCreditsModal from "../AdjustCreditsModal";

interface UserAtLimit {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  events_contracted: number;
  events_used: number;
  available_events: number;
  is_super_admin?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  systemLimit: number;
  onUserUpdated: () => void;
}

const UsersAtLimitModal = ({ open, onOpenChange, onUserUpdated }: Props) => {
  const [users, setUsers] = useState<UserAtLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustCreditsOpen, setAdjustCreditsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAtLimit | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchUsersAtLimit();
    }
  }, [open]);

  const fetchUsersAtLimit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_users" },
      });

      if (error) throw error;

      const usersAtLimit = (data.users || []).filter((user: UserAtLimit) => {
        // Skip super admins
        if (user.is_super_admin) return false;
        // Users with no credits available
        return user.available_events === 0;
      });

      setUsers(usersAtLimit);
    } catch (err) {
      console.error("Error fetching users at limit:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async (user: UserAtLimit) => {
    try {
      const newTotal = (user.events_contracted || 0) + 5;

      const { error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "update_user_credits",
          userId: user.user_id,
          eventsContracted: newTotal,
          reason: "Adição rápida via dashboard (+5 eventos)",
        },
      });

      if (error) throw error;

      toast({ title: "+5 eventos adicionados" });
      fetchUsersAtLimit();
      onUserUpdated();
    } catch (err) {
      toast({
        title: "Erro ao adicionar eventos",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Usuários Sem Eventos Disponíveis
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                Nenhum usuário esgotou seus eventos disponíveis
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="destructive" className="text-xs">
                          {user.events_used}/{user.events_contracted} utilizados
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          (0 disponíveis)
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-primary hover:text-primary"
                        onClick={() => handleQuickAdd(user)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        +5
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedUser(user);
                          setAdjustCreditsOpen(true);
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AdjustCreditsModal
        open={adjustCreditsOpen}
        onOpenChange={setAdjustCreditsOpen}
        user={selectedUser}
        onCreditsUpdated={() => {
          fetchUsersAtLimit();
          onUserUpdated();
        }}
      />
    </>
  );
};

export default UsersAtLimitModal;
