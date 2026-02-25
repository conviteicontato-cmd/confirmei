import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ApprovedUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  approved_at: string | null;
  event_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ApprovedUsersModal = ({ open, onOpenChange }: Props) => {
  const [users, setUsers] = useState<ApprovedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchApprovedUsers();
    }
  }, [open]);

  const fetchApprovedUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_users" },
      });

      if (error) throw error;
      
      const approvedUsers = (data.users || [])
        .filter((u: ApprovedUser & { status: string }) => u.status === "approved")
        .sort((a: ApprovedUser, b: ApprovedUser) => {
          const dateA = a.approved_at ? new Date(a.approved_at).getTime() : 0;
          const dateB = b.approved_at ? new Date(b.approved_at).getTime() : 0;
          return dateB - dateA;
        });
      
      setUsers(approvedUsers);
    } catch (err) {
      console.error("Error fetching approved users:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-500" />
            Usuários Aprovados
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Nenhum usuário aprovado ainda
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="p-3 bg-green-50/50 dark:bg-green-500/5 border border-green-200/50 dark:border-green-500/20 rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    <Calendar className="h-3 w-3 mr-1" />
                    {user.event_count} eventos
                  </Badge>
                </div>
                {user.approved_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Aprovado em: {format(new Date(user.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApprovedUsersModal;
