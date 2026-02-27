import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Loader2, 
  UserCheck, 
  UserX,
  Shield,
  Settings,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";
import UserDetailModal from "./UserDetailModal";
import AdjustLimitModal from "./AdjustLimitModal";
import AdjustCreditsModal from "./AdjustCreditsModal";
import CreateUserModal from "./CreateUserModal";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  rejection_reason: string | null;
  roles: string[];
  event_limit: number | null;
  event_count: number;
  events_contracted: number;
  events_used: number;
  available_events: number;
  is_super_admin?: boolean;
}

const SUPER_ADMIN_EMAIL = "nanacomunicaa@gmail.com";

const AdminUsers = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "no_credits">("all");
  const [adjustCreditsOpen, setAdjustCreditsOpen] = useState(false);
  const [selectedUserForCredits, setSelectedUserForCredits] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [adjustLimitOpen, setAdjustLimitOpen] = useState(false);
  const [selectedUserForLimit, setSelectedUserForLimit] = useState<UserProfile | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const { toast } = useToast();
  const { settings } = useSystemSettings();

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_all_users" },
      });

      if (error) throw error;
      setUsers(data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "approve_user", userId },
      });

      if (error) throw error;

      toast({
        title: "Usuário aprovado",
        description: "O usuário agora pode acessar o sistema",
      });

      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao aprovar usuário";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;

    setActionLoading(selectedUser.user_id);
    try {
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: { 
          action: "reject_user", 
          userId: selectedUser.user_id,
          reason: rejectReason || null,
        },
      });

      if (error) throw error;

      toast({
        title: "Usuário rejeitado",
        description: "O cadastro do usuário foi rejeitado",
      });

      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedUser(null);
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao rejeitar usuário";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    setActionLoading(user.user_id);
    try {
      const action = user.status === "approved" ? "deactivate_user" : "reactivate_user";
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: { action, userId: user.user_id },
      });

      if (error) throw error;

      toast({
        title: user.status === "approved" ? "Usuário desativado" : "Usuário reativado",
      });

      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao alterar status";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const hasNoCredits = (user: UserProfile) => {
    if (user.is_super_admin) return false;
    return user.available_events === 0;
  };

  const filteredUsers = users.filter((user) => {
    let matchesFilter = true;
    
    if (filter === "no_credits") {
      matchesFilter = hasNoCredits(user);
    } else if (filter !== "all") {
      matchesFilter = user.status === filter;
    }
    
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Pendente</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground mt-1">
            Aprovar, rejeitar e gerenciar usuários do sistema
          </p>
        </div>
        <Button onClick={() => setCreateUserOpen(true)}>
          + Criar Usuário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
            <SelectItem value="no_credits">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                Sem eventos disponíveis
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Eventos</TableHead>
              <TableHead className="hidden lg:table-cell">Cadastro</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isSuperAdmin = user.is_super_admin || user.roles?.includes("super_admin");
                const noCredits = !isSuperAdmin && user.available_events === 0;
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {user.full_name}
                          {user.email === SUPER_ADMIN_EMAIL && (
                            <Shield className="h-4 w-4 text-primary" />
                          )}
                          {isSuperAdmin && (
                            <Badge className="bg-primary/10 text-primary border-primary/30 text-xs">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        {isSuperAdmin ? (
                          <span className="font-medium text-primary">∞ Ilimitado</span>
                        ) : (
                          <>
                            <span className={`font-medium ${noCredits ? "text-destructive" : ""}`}>
                              {user.events_used}/{user.events_contracted}
                            </span>
                            <span className={`text-sm ${noCredits ? "text-destructive" : "text-muted-foreground"}`}>
                              ({user.available_events} disp.)
                            </span>
                            {noCredits && (
                              <Badge variant="destructive" className="text-xs">Esgotado</Badge>
                            )}
                          </>
                        )}
                        {!isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => {
                              setSelectedUserForCredits(user);
                              setAdjustCreditsOpen(true);
                            }}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* View Details Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUser(user);
                            setDetailModalOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {user.email === SUPER_ADMIN_EMAIL ? (
                          <span className="text-sm text-muted-foreground px-2 py-1">Protegido</span>
                        ) : user.status === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-500/10"
                              onClick={() => handleApprove(user.user_id)}
                              disabled={actionLoading === user.user_id}
                            >
                              {actionLoading === user.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedUser(user);
                                setRejectDialogOpen(true);
                              }}
                              disabled={actionLoading === user.user_id}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(user)}
                            disabled={actionLoading === user.user_id}
                            className={user.status === "approved" ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-700"}
                          >
                            {actionLoading === user.user_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.status === "approved" ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Cadastro</DialogTitle>
            <DialogDescription>
              Você está prestes a rejeitar o cadastro de{" "}
              <strong>{selectedUser?.full_name}</strong> ({selectedUser?.email}).
              Esta ação pode ser revertida posteriormente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea
                placeholder="Explique o motivo da rejeição..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading === selectedUser?.user_id}
            >
              {actionLoading === selectedUser?.user_id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onUserUpdated={fetchUsers}
        systemLimit={settings.max_events_per_user}
      />

      {/* Adjust Limit Modal */}
      <AdjustLimitModal
        open={adjustLimitOpen}
        onOpenChange={setAdjustLimitOpen}
        user={selectedUserForLimit}
        systemLimit={settings.max_events_per_user}
        onLimitUpdated={fetchUsers}
      />

      {/* Adjust Credits Modal */}
      <AdjustCreditsModal
        open={adjustCreditsOpen}
        onOpenChange={setAdjustCreditsOpen}
        user={selectedUserForCredits}
        onCreditsUpdated={fetchUsers}
      />

      {/* Create User Modal */}
      <CreateUserModal
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        onUserCreated={fetchUsers}
      />
    </div>
  );
};

export default AdminUsers;
