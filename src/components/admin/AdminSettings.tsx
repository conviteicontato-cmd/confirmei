import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings, Users, Calendar, Shield } from "lucide-react";

interface SystemSettings {
  registration_enabled: boolean;
  require_approval: boolean;
  max_events_per_user: number;
  max_guests_per_event: number;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    registration_enabled: true,
    require_approval: true,
    max_events_per_user: 50,
    max_guests_per_event: 500,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase.functions.invoke("admin-operations", {
          body: { action: "get_settings" },
        });

        if (error) throw error;
        
        if (data.settings) {
          setSettings({
            registration_enabled: data.settings.registration_enabled === true || data.settings.registration_enabled === "true",
            require_approval: data.settings.require_approval === true || data.settings.require_approval === "true",
            max_events_per_user: Number(data.settings.max_events_per_user) || 50,
            max_guests_per_event: Number(data.settings.max_guests_per_event) || 500,
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        toast({
          title: "Erro",
          description: "Não foi possível carregar as configurações",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "update_settings",
          settings: {
            registration_enabled: settings.registration_enabled,
            require_approval: settings.require_approval,
            max_events_per_user: settings.max_events_per_user,
            max_guests_per_event: settings.max_guests_per_event,
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso",
      });
    } catch (err) {
      console.error("Error saving settings:", err);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Configurações do Sistema
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerenciar configurações globais da plataforma
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* Registration Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Cadastro de Usuários</CardTitle>
            </div>
            <CardDescription>
              Configure como novos usuários podem se cadastrar na plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="registration_enabled">Cadastros Habilitados</Label>
                <p className="text-sm text-muted-foreground">
                  Permitir que novos usuários se cadastrem
                </p>
              </div>
              <Switch
                id="registration_enabled"
                checked={settings.registration_enabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, registration_enabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="require_approval">Aprovação Obrigatória</Label>
                <p className="text-sm text-muted-foreground">
                  Novos cadastros precisam de aprovação do admin
                </p>
              </div>
              <Switch
                id="require_approval"
                checked={settings.require_approval}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, require_approval: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Limits Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>Limites de Uso</CardTitle>
            </div>
            <CardDescription>
              Defina limites para eventos e convidados por usuário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="max_events">Máximo de Eventos por Usuário</Label>
              <Input
                id="max_events"
                type="number"
                min={1}
                max={1000}
                value={settings.max_events_per_user}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_events_per_user: parseInt(e.target.value) || 50,
                  })
                }
              />
              <p className="text-sm text-muted-foreground">
                Número máximo de eventos que cada organizador pode criar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_guests">Máximo de Convidados por Evento</Label>
              <Input
                id="max_guests"
                type="number"
                min={1}
                max={10000}
                value={settings.max_guests_per_event}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    max_guests_per_event: parseInt(e.target.value) || 500,
                  })
                }
              />
              <p className="text-sm text-muted-foreground">
                Número máximo de convidados que cada evento pode ter
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security Info */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Segurança</CardTitle>
            </div>
            <CardDescription>
              Informações de segurança do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">Super Admin</span>
                <span className="text-sm text-muted-foreground">nanacomunicaa@gmail.com</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm font-medium">Proteção de Senhas</span>
                <span className="text-sm text-yellow-600">Verificar no Backend</span>
              </div>
              <p className="text-sm text-muted-foreground">
                O administrador principal não pode ser desativado ou ter suas permissões removidas.
                Para ativar a proteção contra senhas vazadas, acesse as configurações de autenticação do backend.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettings;
