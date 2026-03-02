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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Loader2, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user?: {
    user_id: string;
    full_name: string;
    email: string;
  };
}

const ACTION_LABELS: Record<string, string> = {
  approve_user: "Aprovar Usuário",
  reject_user: "Rejeitar Usuário",
  deactivate_user: "Desativar Usuário",
  reactivate_user: "Reativar Usuário",
  update_settings: "Atualizar Configurações",
  initial_admin_setup: "Configuração Inicial Admin",
  activate_event: "Ativar Evento",
  deactivate_event: "Desativar Evento",
};

const ENTITY_LABELS: Record<string, string> = {
  profile: "Perfil",
  event: "Evento",
  system: "Sistema",
  system_settings: "Configurações",
};

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    async function fetchLogs() {
      try {
        const filters: Record<string, string> = {};
        if (actionFilter !== "all") {
          filters.action = actionFilter;
        }

        const { data, error } = await supabase.functions.invoke("admin-operations", {
          body: { 
            action: "get_audit_logs", 
            limit: 100,
            filters,
          },
        });

        if (error) throw error;
        setLogs(data.logs || []);
      } catch (err) {
        console.error("Error fetching audit logs:", err);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os logs",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [actionFilter]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const exportToCSV = () => {
    const headers = ["Data/Hora", "Usuário", "Ação", "Entidade", "Detalhes"];
    const rows = filteredLogs.map((log) => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      log.user?.email || "Sistema",
      ACTION_LABELS[log.action] || log.action,
      ENTITY_LABELS[log.entity_type] || log.entity_type,
      JSON.stringify(log.details || {}),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) link.parentNode.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getActionBadge = (action: string) => {
    if (action.includes("approve") || action.includes("reactivate") || action.includes("activate")) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">{ACTION_LABELS[action] || action}</Badge>;
    }
    if (action.includes("reject") || action.includes("deactivate")) {
      return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">{ACTION_LABELS[action] || action}</Badge>;
    }
    if (action.includes("update") || action.includes("setup")) {
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">{ACTION_LABELS[action] || action}</Badge>;
    }
    return <Badge variant="outline">{ACTION_LABELS[action] || action}</Badge>;
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Logs de Auditoria
          </h1>
          <p className="text-muted-foreground mt-1">
            Histórico de todas as ações administrativas
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="shrink-0">
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário ou ação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filtrar por ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="approve_user">Aprovar Usuário</SelectItem>
            <SelectItem value="reject_user">Rejeitar Usuário</SelectItem>
            <SelectItem value="deactivate_user">Desativar Usuário</SelectItem>
            <SelectItem value="reactivate_user">Reativar Usuário</SelectItem>
            <SelectItem value="update_settings">Atualizar Configurações</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead className="hidden md:table-cell">Entidade</TableHead>
              <TableHead className="hidden lg:table-cell">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum log encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell>
                    {log.user ? (
                      <div>
                        <div className="font-medium">{log.user.full_name}</div>
                        <div className="text-sm text-muted-foreground">{log.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Sistema</span>
                    )}
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {ENTITY_LABELS[log.entity_type] || log.entity_type}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-xs">
                    {log.details ? (
                      <span className="text-sm text-muted-foreground truncate block">
                        {JSON.stringify(log.details)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminAuditLogs;
