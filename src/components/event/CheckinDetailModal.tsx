import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Users, Baby, Check, Loader2, AlertTriangle, Minus, Plus } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface Companion {
  name: string;
  index?: number;
  checked_in?: boolean;
  checked_in_at?: string;
}

interface Child {
  name: string;
  age?: string;
  index?: number;
  checked_in?: boolean;
  checked_in_at?: string;
}

export interface CheckinGuest {
  id: string;
  name: string;
  confirmed_adults: number | null;
  confirmed_children: number | null;
  max_adults: number | null;
  max_children: number | null;
  checkin_done: boolean | null;
  checkin_at: string | null;
  companions: Json | null;
  children: Json | null;
  status: string | null;
}

interface CheckinDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest: CheckinGuest | null;
  onSuccess: () => void;
}

const parseCompanions = (json: Json | null): Companion[] => {
  if (!json || !Array.isArray(json)) return [];
  return json as unknown as Companion[];
};

const parseChildren = (json: Json | null): Child[] => {
  if (!json || !Array.isArray(json)) return [];
  return json as unknown as Child[];
};

const CheckinDetailModal = ({ open, onOpenChange, guest, onSuccess }: CheckinDetailModalProps) => {
  const [saving, setSaving] = useState(false);
  const [mainChecked, setMainChecked] = useState(false);
  const [companionChecks, setCompanionChecks] = useState<boolean[]>([]);
  const [childrenChecks, setChildrenChecks] = useState<boolean[]>([]);
  // Fallback quantity mode (for old confirmations without names)
  const [fallbackAdults, setFallbackAdults] = useState(0);
  const [fallbackChildren, setFallbackChildren] = useState(0);
  const { toast } = useToast();

  const companions = useMemo(() => guest ? parseCompanions(guest.companions) : [], [guest]);
  const children = useMemo(() => guest ? parseChildren(guest.children) : [], [guest]);

  // Determine if we have named companions/children or just quantities
  const hasNames = companions.some(c => c.name?.trim()) || children.some(c => c.name?.trim());

  // Calculate already checked in counts
  const alreadyCheckedAdults = useMemo(() => {
    if (!hasNames) return 0;
    let count = 0;
    if (companions.some(c => c.checked_in)) count += companions.filter(c => c.checked_in).length;
    return count;
  }, [companions, hasNames]);

  const alreadyCheckedChildren = useMemo(() => {
    if (!hasNames) return 0;
    return children.filter(c => c.checked_in).length;
  }, [children, hasNames]);

  // Initialize state when guest changes or modal opens
  useEffect(() => {
    if (open && guest) {
      setMainChecked(guest.checkin_done || false);
      setCompanionChecks(companions.map(c => c.checked_in || false));
      setChildrenChecks(children.map(c => c.checked_in || false));
      setFallbackAdults(0);
      setFallbackChildren(0);
    }
  }, [open, guest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxAdults = (guest?.confirmed_adults || guest?.max_adults || 1);
  const maxChildren = (guest?.confirmed_children || guest?.max_children || 0);

  // For named mode
  const totalPeople = hasNames ? (1 + companions.length + children.length) : 0;
  const checkedCount = hasNames
    ? (mainChecked ? 1 : 0) + companionChecks.filter(c => c).length + childrenChecks.filter(c => c).length
    : 0;

  const allComplete = hasNames
    ? checkedCount === totalPeople
    : (fallbackAdults >= maxAdults && fallbackChildren >= maxChildren);

  const handleSave = async () => {
    if (!guest) return;
    setSaving(true);

    try {
      if (hasNames) {
        const now = new Date().toISOString();
        const updatedCompanions = companions.map((c, i) => ({
          ...c,
          checked_in: companionChecks[i] || false,
          checked_in_at: companionChecks[i] && !c.checked_in ? now : c.checked_in_at || null,
        }));
        const updatedChildren = children.map((c, i) => ({
          ...c,
          checked_in: childrenChecks[i] || false,
          checked_in_at: childrenChecks[i] && !c.checked_in ? now : c.checked_in_at || null,
        }));

        const allCheckedIn = mainChecked &&
          companionChecks.every(c => c) &&
          childrenChecks.every(c => c);

        const { error } = await supabase
          .from("guests")
          .update({
            checkin_done: allCheckedIn,
            checkin_at: allCheckedIn ? now : guest.checkin_at || null,
            companions: updatedCompanions as unknown as Json,
            children: updatedChildren as unknown as Json,
            qr_used: true,
          })
          .eq("id", guest.id);

        if (error) throw error;

        const adultsIn = (mainChecked ? 1 : 0) + companionChecks.filter(c => c).length;
        const childrenIn = childrenChecks.filter(c => c).length;

        toast({
          title: "Check-in registrado ✅",
          description: `${guest.name} — Adultos +${adultsIn} / Crianças +${childrenIn}`,
        });
      } else {
        // Fallback quantity mode
        const newAdults = Math.min(fallbackAdults, maxAdults);
        const newChildren = Math.min(fallbackChildren, maxChildren);
        const allDone = newAdults >= maxAdults && newChildren >= maxChildren;

        const { error } = await supabase
          .from("guests")
          .update({
            checkin_done: allDone,
            checkin_at: allDone ? new Date().toISOString() : guest.checkin_at || null,
            qr_used: true,
          })
          .eq("id", guest.id);

        if (error) throw error;

        toast({
          title: "Check-in registrado ✅",
          description: `${guest.name} — Adultos +${newAdults} / Crianças +${newChildren}`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCheckAll = () => {
    setMainChecked(true);
    setCompanionChecks(companions.map(() => true));
    setChildrenChecks(children.map(() => true));
  };

  if (!guest) return null;

  const isAlreadyComplete = guest.checkin_done && hasNames &&
    companions.every(c => c.checked_in) &&
    children.every(c => c.checked_in);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" />
            Check-in: {guest.name}
          </DialogTitle>
          <DialogDescription>
            {isAlreadyComplete
              ? "Check-in já completo para todos."
              : "Marque quem chegou ao evento."}
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-muted-foreground text-xs">Máx Adultos</p>
            <p className="font-bold">{maxAdults}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-muted-foreground text-xs">Máx Crianças</p>
            <p className="font-bold">{maxChildren}</p>
          </div>
        </div>

        {isAlreadyComplete && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400">
            <Check className="h-5 w-5" />
            <span className="text-sm font-medium">Check-in já completo!</span>
          </div>
        )}

        <div className="space-y-4 py-2">
          {hasNames ? (
            <>
              {/* Progress */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{checkedCount}/{totalPeople} pessoas</span>
              </div>

              {/* Main Guest */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Checkbox
                  id="main-guest"
                  checked={mainChecked}
                  onCheckedChange={(checked) => setMainChecked(checked === true)}
                />
                <label htmlFor="main-guest" className="flex-1 cursor-pointer">
                  <span className="font-medium text-foreground">{guest.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">(Titular)</span>
                </label>
              </div>

              {/* Companions */}
              {companions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>Acompanhantes ({companions.length})</span>
                  </div>
                  {companions.map((companion, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Checkbox
                        id={`companion-${index}`}
                        checked={companionChecks[index] || false}
                        onCheckedChange={(checked) => {
                          const newChecks = [...companionChecks];
                          newChecks[index] = checked === true;
                          setCompanionChecks(newChecks);
                        }}
                      />
                      <label htmlFor={`companion-${index}`} className="flex-1 cursor-pointer text-foreground">
                        {companion.name || `Acompanhante ${index + 1}`}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Children */}
              {children.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Baby className="h-4 w-4" />
                    <span>Crianças ({children.length})</span>
                  </div>
                  {children.map((child, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Checkbox
                        id={`child-${index}`}
                        checked={childrenChecks[index] || false}
                        onCheckedChange={(checked) => {
                          const newChecks = [...childrenChecks];
                          newChecks[index] = checked === true;
                          setChildrenChecks(newChecks);
                        }}
                      />
                      <label htmlFor={`child-${index}`} className="flex-1 cursor-pointer text-foreground">
                        {child.name || `Criança ${index + 1}`}
                        {child.age && <span className="text-muted-foreground text-sm ml-1">({child.age})</span>}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Fallback quantity mode */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-xs">Sem nomes registrados. Usando modo por quantidade.</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Adultos chegando agora</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFallbackAdults(Math.max(0, fallbackAdults - 1))}
                      disabled={fallbackAdults <= 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-bold">{fallbackAdults}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFallbackAdults(Math.min(maxAdults, fallbackAdults + 1))}
                      disabled={fallbackAdults >= maxAdults}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground">/ {maxAdults}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Crianças chegando agora</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFallbackChildren(Math.max(0, fallbackChildren - 1))}
                      disabled={fallbackChildren <= 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-bold">{fallbackChildren}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setFallbackChildren(Math.min(maxChildren, fallbackChildren + 1))}
                      disabled={fallbackChildren >= maxChildren}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground">/ {maxChildren}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {hasNames && (
            <Button
              variant="outline"
              onClick={handleCheckAll}
              disabled={saving || checkedCount === totalPeople}
              className="w-full sm:w-auto"
            >
              Marcar Todos
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="btn-gold w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Check-in"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CheckinDetailModal;
