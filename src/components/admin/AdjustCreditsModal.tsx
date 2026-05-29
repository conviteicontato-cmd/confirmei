import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, FileText, QrCode, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  events_contracted?: number;
  events_used?: number;
  available_events?: number;
  credits_standard?: number;
  credits_qr?: number;
  is_super_admin?: boolean;
  roles?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onCreditsUpdated: () => void;
  initialTab?: "standard" | "qr";
}

const AdjustCreditsModal = ({ open, onOpenChange, user, onCreditsUpdated, initialTab = "standard" }: Props) => {
  const [currentStandard, setCurrentStandard] = useState(0);
  const [currentQr, setCurrentQr] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [addStandard, setAddStandard] = useState("0");
  const [addQr, setAddQr] = useState("0");
  const [reason, setReason] = useState("");
  const [resetUsage, setResetUsage] = useState(false);
  const [mobileTab, setMobileTab] = useState<"standard" | "qr">(initialTab);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { toast } = useToast();

  const isSuperAdmin = user?.is_super_admin || user?.roles?.includes("super_admin");

  const fetchCreditDetails = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: { action: "get_user_credit_details", userId: user.user_id },
      });
      if (error) throw error;
      setCurrentStandard(data?.credits_standard ?? 0);
      setCurrentQr(data?.credits_qr ?? 0);
      setTotalEvents((data?.upcoming_events?.length || 0) + (data?.past_events?.length || 0));
    } catch {
      // Fallback to whatever the user object carries
      setCurrentStandard(user.credits_standard ?? 0);
      setCurrentQr(user.credits_qr ?? 0);
      setTotalEvents(user.events_used ?? 0);
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && user && !isSuperAdmin) {
      setAddStandard("0");
      setAddQr("0");
      setReason("");
      setResetUsage(false);
      setMobileTab(initialTab);
      fetchCreditDetails();
    }
  }, [open, user, isSuperAdmin, initialTab, fetchCreditDetails]);

  const addStandardNum = Math.max(0, parseInt(addStandard, 10) || 0);
  const addQrNum = Math.max(0, parseInt(addQr, 10) || 0);
  const previewStandard = currentStandard + addStandardNum;
  const previewQr = currentQr + addQrNum;

  const handleSave = async () => {
    if (!user) return;

    if (addStandardNum === 0 && addQrNum === 0) {
      toast({
        title: "Nada para salvar",
        description: "Informe uma quantidade para adicionar em pelo menos um tipo",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "adjust_user_credits",
          userId: user.user_id,
          creditsStandard: previewStandard,
          creditsQr: previewQr,
          resetEvents: resetUsage,
          reason:
            reason ||
            `Ajuste de créditos (+${addStandardNum} comum, +${addQrNum} QR)${resetUsage ? " • reset de uso" : ""}`,
        },
      });

      if (error) throw error;

      toast({ title: "Créditos atualizados com sucesso" });
      onCreditsUpdated();
      onOpenChange(false);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os créditos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  // Super Admin check
  if (isSuperAdmin) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Créditos</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">∞</span>
            </div>
            <p className="font-medium text-lg">{user.full_name}</p>
            <p className="text-muted-foreground">Este usuário é Super Admin</p>
            <p className="text-sm text-muted-foreground mt-2">
              Super Admins têm eventos ilimitados e não consomem créditos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Section for one credit type
  const CreditSection = ({ type }: { type: "standard" | "qr" }) => {
    const isStandard = type === "standard";
    const current = isStandard ? currentStandard : currentQr;
    const preview = isStandard ? previewStandard : previewQr;
    const value = isStandard ? addStandard : addQr;
    const setValue = isStandard ? setAddStandard : setAddQr;

    return (
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isStandard ? (
              <FileText className="h-4 w-4 text-amber-600" />
            ) : (
              <QrCode className="h-4 w-4 text-primary" />
            )}
            <span className="font-medium text-sm">
              {isStandard ? "Formulário Comum" : "Formulário com QR Code"}
            </span>
          </div>
          {isStandard ? (
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30" variant="outline">
              Padrão
            </Badge>
          ) : (
            <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">
              QR Code
            </Badge>
          )}
        </div>

        <div className="text-center bg-muted/40 rounded-lg py-3">
          <div className={`text-3xl font-bold ${isStandard ? "text-amber-600" : "text-primary"}`}>
            {current}
          </div>
          <div className="text-xs text-muted-foreground">Créditos atuais</div>
        </div>

        <div>
          <Label htmlFor={`add-${type}`}>Adicionar quantidade</Label>
          <Input
            id={`add-${type}`}
            type="number"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Após adição: </span>
            <span className="font-medium text-green-600">{preview} créditos</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Créditos</DialogTitle>
          <DialogDescription>
            Ajuste os créditos por tipo para <strong>{user.full_name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
              <FileText className="h-4 w-4" />
            </div>
            <div className="text-xl font-bold text-amber-600">
              {fetching ? "…" : currentStandard}
            </div>
            <div className="text-xs text-muted-foreground">Comuns disponíveis</div>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <QrCode className="h-4 w-4" />
            </div>
            <div className="text-xl font-bold text-primary">{fetching ? "…" : currentQr}</div>
            <div className="text-xs text-muted-foreground">QR disponíveis</div>
          </div>
          <div className="bg-muted/40 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="text-xl font-bold">{fetching ? "…" : totalEvents}</div>
            <div className="text-xs text-muted-foreground">Eventos criados</div>
          </div>
        </div>

        {/* Side-by-side on desktop, tabs on mobile */}
        <div className="hidden sm:grid sm:grid-cols-2 gap-4">
          <CreditSection type="standard" />
          <CreditSection type="qr" />
        </div>

        <div className="sm:hidden">
          <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as "standard" | "qr")}>
            <TabsList className="w-full">
              <TabsTrigger value="standard" className="flex-1">
                <FileText className="h-4 w-4 mr-1" />
                Comum
              </TabsTrigger>
              <TabsTrigger value="qr" className="flex-1">
                <QrCode className="h-4 w-4 mr-1" />
                QR Code
              </TabsTrigger>
            </TabsList>
            <TabsContent value="standard" className="mt-4">
              <CreditSection type="standard" />
            </TabsContent>
            <TabsContent value="qr" className="mt-4">
              <CreditSection type="qr" />
            </TabsContent>
          </Tabs>
        </div>

        {/* Reason */}
        <div>
          <Label htmlFor="reason">Motivo (opcional)</Label>
          <Textarea
            id="reason"
            placeholder="Ex: Pacote premium, renovação..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1"
            rows={2}
          />
        </div>

        {/* Reset usage */}
        <div className="flex items-start gap-2 rounded-lg border p-3">
          <Checkbox
            id="resetUsage"
            checked={resetUsage}
            onCheckedChange={(v) => setResetUsage(!!v)}
            className="mt-0.5"
          />
          <Label htmlFor="resetUsage" className="font-normal cursor-pointer">
            Resetar contadores de uso
            <span className="block text-xs text-muted-foreground">
              Zera os eventos utilizados antes de aplicar os novos créditos.
            </span>
          </Label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading || fetching}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Créditos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdjustCreditsModal;
