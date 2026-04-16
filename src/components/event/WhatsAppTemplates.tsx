import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Save, Loader2, MessageSquare, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WhatsAppTemplatesProps {
  eventId: string;
  onBack: () => void;
}

interface Template {
  id?: string;
  template_type: string;
  title: string;
  message_body: string;
}

const TEMPLATE_TYPES = [
  {
    type: "confirmation",
    label: "Mensagem de Confirmação",
    description: "Para avisar que a presença foi confirmada com sucesso",
    defaultBody: "Olá, {{nome_convidado}}! Sua presença no evento {{nome_evento}} foi confirmada com sucesso. Ficaremos felizes em te receber!",
  },
  {
    type: "reminder",
    label: "Mensagem de Lembrete",
    description: "Para lembrar o convidado de confirmar ou avisar que o evento está próximo",
    defaultBody: "Olá, {{nome_convidado}}! O evento {{nome_evento}} está chegando. Caso ainda não tenha confirmado sua presença, pedimos que confirme o quanto antes.",
  },
  {
    type: "extra",
    label: "Mensagem Extra",
    description: "Mensagem coringa para qualquer eventualidade",
    defaultBody: "Olá, {{nome_convidado}}! Estamos entrando em contato sobre o evento {{nome_evento}}. Qualquer dúvida, estamos à disposição.",
  },
];

const VARIABLES = [
  { key: "{{nome_convidado}}", label: "Nome do convidado" },
  { key: "{{nome_evento}}", label: "Nome do evento" },
  { key: "{{data_evento}}", label: "Data do evento" },
  { key: "{{link_confirmacao}}", label: "Link de confirmação" },
];

const WhatsAppTemplates = ({ eventId, onBack }: WhatsAppTemplatesProps) => {
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("event_id", eventId);

      if (error) throw error;

      const map: Record<string, Template> = {};
      TEMPLATE_TYPES.forEach((t) => {
        const existing = data?.find((d: any) => d.template_type === t.type);
        map[t.type] = existing
          ? { id: existing.id, template_type: existing.template_type, title: existing.title, message_body: existing.message_body }
          : { template_type: t.type, title: t.label, message_body: t.defaultBody };
      });
      setTemplates(map);
    } catch (error: any) {
      toast({ title: "Erro ao carregar templates", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSave = async (type: string) => {
    const template = templates[type];
    if (!template) return;

    if (!template.title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }

    setSavingType(type);
    try {
      if (template.id) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update({ title: template.title.trim(), message_body: template.message_body })
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("whatsapp_templates")
          .insert({
            event_id: eventId,
            template_type: type,
            title: template.title.trim(),
            message_body: template.message_body,
          })
          .select()
          .single();
        if (error) throw error;
        setTemplates((prev) => ({
          ...prev,
          [type]: { ...prev[type], id: data.id },
        }));
      }
      toast({ title: "Mensagem salva!", description: `Template "${template.title}" salvo com sucesso.` });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSavingType(null);
    }
  };

  const updateTemplate = (type: string, field: "title" | "message_body", value: string) => {
    setTemplates((prev) => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-accent rounded-lg transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Mensagens de WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm">Configure mensagens prontas para enviar aos convidados</p>
        </div>
      </div>

      {/* Variables Reference */}
      <div className="card-elegant p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Variáveis disponíveis</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {VARIABLES.map((v) => (
            <Tooltip key={v.key}>
              <TooltipTrigger>
                <Badge variant="secondary" className="font-mono text-xs cursor-help">
                  {v.key}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{v.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {TEMPLATE_TYPES.map((t) => {
          const template = templates[t.type];
          if (!template) return null;
          const charCount = template.message_body.length;

          return (
            <div key={t.type} className="card-elegant p-6 space-y-4">
              <div>
                <h3 className="font-medium text-foreground">{t.label}</h3>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Título interno</Label>
                <Input
                  value={template.title}
                  onChange={(e) => updateTemplate(t.type, "title", e.target.value)}
                  className="input-elegant"
                  placeholder="Ex: Confirmação de presença"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Mensagem</Label>
                <Textarea
                  value={template.message_body}
                  onChange={(e) => updateTemplate(t.type, "message_body", e.target.value)}
                  className="input-elegant resize-none min-h-[120px]"
                  placeholder="Escreva a mensagem aqui..."
                />
                <p className="text-xs text-muted-foreground text-right">{charCount} caracteres</p>
              </div>

              <Button
                onClick={() => handleSave(t.type)}
                disabled={savingType === t.type}
                className="w-full sm:w-auto"
              >
                {savingType === t.type ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WhatsAppTemplates;
