 import { useState } from "react";
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
 } from "@/components/ui/dialog";
 import { Users, Baby, Check, Loader2 } from "lucide-react";
 import { Json } from "@/integrations/supabase/types";
 
 interface Companion {
   name: string;
   checked_in?: boolean;
 }
 
 interface Child {
   name: string;
   age?: string;
   checked_in?: boolean;
 }
 
 interface Guest {
   id: string;
   name: string;
   confirmed_adults: number | null;
   confirmed_children: number | null;
   checkin_done: boolean | null;
   companions: Json | null;
   children: Json | null;
 }
 
 interface CheckinDetailModalProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   guest: Guest | null;
   onSuccess: () => void;
 }
 
 const CheckinDetailModal = ({ open, onOpenChange, guest, onSuccess }: CheckinDetailModalProps) => {
   const [saving, setSaving] = useState(false);
   const [mainChecked, setMainChecked] = useState(false);
   const [companionChecks, setCompanionChecks] = useState<boolean[]>([]);
   const [childrenChecks, setChildrenChecks] = useState<boolean[]>([]);
   const { toast } = useToast();
 
   const parseCompanions = (json: Json | null): Companion[] => {
     if (!json || !Array.isArray(json)) return [];
    return json as unknown as Companion[];
   };
 
   const parseChildren = (json: Json | null): Child[] => {
     if (!json || !Array.isArray(json)) return [];
    return json as unknown as Child[];
   };
 
   // Initialize state when guest changes
   const companions = guest ? parseCompanions(guest.companions) : [];
   const children = guest ? parseChildren(guest.children) : [];
 
   // Reset state when modal opens
   const handleOpenChange = (isOpen: boolean) => {
     if (isOpen && guest) {
       setMainChecked(guest.checkin_done || false);
       setCompanionChecks(companions.map(c => c.checked_in || false));
       setChildrenChecks(children.map(c => c.checked_in || false));
     }
     onOpenChange(isOpen);
   };
 
   const handleSave = async () => {
     if (!guest) return;
 
     setSaving(true);
     try {
       // Update companions with checked_in status
       const updatedCompanions = companions.map((c, i) => ({
         ...c,
         checked_in: companionChecks[i] || false,
       }));
 
       // Update children with checked_in status
       const updatedChildren = children.map((c, i) => ({
         ...c,
         checked_in: childrenChecks[i] || false,
       }));
 
       // Check if all are checked in
       const allCheckedIn = mainChecked && 
         companionChecks.every(c => c) && 
         childrenChecks.every(c => c);
 
       const { error } = await supabase
         .from("guests")
         .update({
           checkin_done: allCheckedIn,
           checkin_at: allCheckedIn ? new Date().toISOString() : guest.checkin_done ? undefined : null,
           companions: updatedCompanions as unknown as Json,
           children: updatedChildren as unknown as Json,
         })
         .eq("id", guest.id);
 
       if (error) throw error;
 
       toast({
         title: "Check-in atualizado",
         description: allCheckedIn 
           ? `${guest.name} e todos os acompanhantes foram registrados.`
           : "Presenças individuais atualizadas.",
       });
 
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
 
   const totalPeople = 1 + companions.length + children.length;
   const checkedCount = (mainChecked ? 1 : 0) + 
     companionChecks.filter(c => c).length + 
     childrenChecks.filter(c => c).length;
 
   if (!guest) return null;
 
   return (
     <Dialog open={open} onOpenChange={handleOpenChange}>
       <DialogContent className="max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Check className="h-5 w-5 text-primary" />
             Check-in Individual
           </DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4 py-4">
           {/* Progress */}
           <div className="flex items-center justify-between text-sm">
             <span className="text-muted-foreground">Progresso</span>
             <span className="font-medium">{checkedCount}/{totalPeople} pessoas</span>
           </div>
 
           {/* Main Guest */}
           <div className="space-y-3">
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
                       {companion.name}
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
                       {child.name}
                       {child.age && <span className="text-muted-foreground text-sm ml-1">({child.age})</span>}
                     </label>
                   </div>
                 ))}
               </div>
             )}
           </div>
         </div>
 
         <DialogFooter className="flex-col sm:flex-row gap-2">
           <Button 
             variant="outline" 
             onClick={handleCheckAll}
             disabled={saving || checkedCount === totalPeople}
             className="w-full sm:w-auto"
           >
             Marcar Todos
           </Button>
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