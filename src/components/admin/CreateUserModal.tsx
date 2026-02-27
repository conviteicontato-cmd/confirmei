import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Check } from "lucide-react";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

const CreateUserModal = ({ open, onOpenChange, onUserCreated }: CreateUserModalProps) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [autoApprove, setAutoApprove] = useState(true);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdPassword, setCreatedPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "create_user",
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          autoApprove,
        },
      });

      if (error) throw error;

      setCreatedPassword(password);
      setCreated(true);
      onUserCreated();
      toast({ title: "Usuário criado com sucesso!" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar usuário";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setFullName("");
    setEmail("");
    setPassword(generatePassword());
    setAutoApprove(true);
    setCreated(false);
    setCreatedPassword("");
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Usuário</DialogTitle>
          <DialogDescription>
            {created
              ? "Usuário criado. Compartilhe a senha temporária abaixo."
              : "Preencha os dados para criar um novo usuário."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Senha temporária:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background p-2 rounded text-sm font-mono">
                  {createdPassword}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-destructive font-medium">
                ⚠️ Esta senha será exibida apenas uma vez. Peça ao usuário para alterá-la após o primeiro login.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha temporária</Label>
              <div className="flex gap-2">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPassword(generatePassword())}
                >
                  Gerar
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Aprovar automaticamente</Label>
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={loading || !fullName.trim() || !email.trim()}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserModal;
