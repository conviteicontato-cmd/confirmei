import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserX, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RejectedUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  rejection_reason: string | null;
  updated_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
}

const RejectedUsersModal = ({ open, onOpenChange, onUserUpdated }: Props) => {
  const [users, setUsers] = useState<RejectedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchRejectedUsers();
    }
  }, [open]);

  const fetchRejectedUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, rejection_reason, updated_at")
        .eq("status", "rejected")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching rejected users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "approve_user", userId },
      });

      if (error) throw error;

      toast({ title: "Rejeição revertida - usuário aprovado" });
      fetchRejectedUsers();
      onUserUpdated();
    } catch (err) {
      toast({
        title: "Erro ao reverter rejeição",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-destructive" />
            Usuários Rejeitados
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <UserX className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Nenhum usuário rejeitado
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="p-3 bg-red-50/50 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/20 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.rejection_reason && (
                      <p className="text-sm text-destructive mt-1">
                        Motivo: {user.rejection_reason}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Rejeitado em: {format(new Date(user.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleRevert(user.user_id)}
                    disabled={actionLoading === user.user_id}
                  >
                    {actionLoading === user.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Aprovar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RejectedUsersModal;
