import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  FileUp,
  FileDown,
  ExternalLink,
  Users,
  ChevronRight,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import EventStatsCards from "./EventStatsCards";
import GuestTable from "./GuestTable";
import AddGuestModal from "./AddGuestModal";
import EditGuestModal from "./EditGuestModal";
import ShareHostModal from "./ShareHostModal";

import { Json } from "@/integrations/supabase/types";

interface EventManagementProps {
  eventId: string;
  userId: string;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
  cover_image_url: string | null;
  primary_color: string;
  secondary_color: string;
  webhook_url: string | null;
  host_password: string | null;
  allow_host_edit: boolean;
}

export interface Guest {
  id: string;
  name: string;
  status: string | null;
  max_adults: number | null;
  max_children: number | null;
  confirmed_adults: number | null;
  confirmed_children: number | null;
  checkin_done: boolean | null;
  checkin_at: string | null;
  qr_code: string | null;
  observations: string | null;
  companions: Json | null;
  children: Json | null;
  group_name: string | null;
  whatsapp: string | null;
}

interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  checkedIn: number;
  expectedPeople: number;
}

const EventManagement = ({ eventId, userId }: EventManagementProps) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    confirmed: 0,
    pending: 0,
    checkedIn: 0,
    expectedPeople: 0,
  });
  const [loading, setLoading] = useState(true);
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);
  const [shareHostOpen, setShareHostOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEventData = useCallback(async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("user_id", userId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      const { data: guestsData, error: guestsError } = await supabase
        .from("guests")
        .select("id, name, status, max_adults, max_children, confirmed_adults, confirmed_children, checkin_done, checkin_at, qr_code, observations, companions, children, group_name, whatsapp")
        .eq("event_id", eventId)
        .order("name");

      if (guestsError) throw guestsError;
      
      setGuests(guestsData || []);

      const total = guestsData?.length || 0;
      const confirmed = guestsData?.filter((g) => g.status === "confirmed").length || 0;
      const pending = guestsData?.filter((g) => g.status === "pending").length || 0;
      const checkedIn = guestsData?.filter((g) => g.checkin_done).length || 0;
      const expectedPeople = guestsData?.reduce((acc, g) => {
        return acc + (g.confirmed_adults || 0) + (g.confirmed_children || 0);
      }, 0) || 0;

      setStats({ total, confirmed, pending, checkedIn, expectedPeople });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar evento",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [eventId, userId, navigate, toast]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  if (loading) {
    return (
      <div className="p-8">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!event) return null;

  const parseJsonArray = (json: Json | null): Array<{ name: string; age?: string }> => {
    if (!json) return [];
    if (Array.isArray(json)) {
      return json as Array<{ name: string; age?: string }>;
    }
    return [];
  };

  const sanitizeCSVValue = (value: string): string => {
    if (!value || typeof value !== 'string') return '';
    let sanitized = value.trim();
    const dangerous = ['=', '+', '-', '@', '\t', '\r'];
    while (sanitized.length > 0 && dangerous.includes(sanitized[0])) {
      sanitized = sanitized.substring(1);
    }
    return sanitized;
  };

  const escapeCSVCell = (value: string): string => {
    if (!value) return '""';
    const dangerous = ['=', '+', '-', '@'];
    let escaped = value.replace(/"/g, '""');
    if (dangerous.includes(escaped[0])) {
      escaped = "'" + escaped;
    }
    return `"${escaped}"`;
  };

  const translateStatus = (status: string | null): string => {
    switch (status) {
      case "confirmed": return "Confirmado";
      case "pending": return "Pendente";
      case "declined":
      case "canceled":
        return "Recusado";
      default: return "Pendente";
    }
  };

  const exportToCSV = (guestsToExport: Guest[], filename: string) => {
    const headers = ["Nome", "Status", "Máx Adultos", "Máx Crianças", "Adultos Confirmados", "Crianças Confirmadas", "Check-in", "Grupo/Família", "WhatsApp", "Acompanhantes", "Crianças (nome/idade)", "Observações"];
    const csvContent = [
      headers.join(";"),
      ...guestsToExport.map(guest => {
        const companions = parseJsonArray(guest.companions);
        const children = parseJsonArray(guest.children);
        const companionNames = companions.map(c => sanitizeCSVValue(c.name)).join(", ");
        const childrenInfo = children.map(c => `${sanitizeCSVValue(c.name)}${c.age ? ` (${sanitizeCSVValue(c.age)})` : ""}`).join(", ");
        
        return [
          escapeCSVCell(guest.name),
          translateStatus(guest.status),
          guest.max_adults || 0,
          guest.max_children || 0,
          guest.confirmed_adults || 0,
          guest.confirmed_children || 0,
          guest.checkin_done ? "Sim" : "Não",
          escapeCSVCell(guest.group_name || ""),
          escapeCSVCell(guest.whatsapp || ""),
          escapeCSVCell(companionNames),
          escapeCSVCell(childrenInfo),
          escapeCSVCell(guest.observations || "")
        ].join(";");
      })
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };




  const handleExportConfirmed = () => {
    const confirmed = guests.filter(g => g.status === "confirmed");
    if (confirmed.length === 0) {
      toast({ title: "Nenhum confirmado", description: "Não há convidados confirmados para exportar.", variant: "destructive" });
      return;
    }
    exportToCSV(confirmed, `${event.name.replace(/\s+/g, "_")}_confirmados.csv`);
    toast({ title: "CSV exportado", description: `${confirmed.length} confirmados exportados.` });
  };

  const handleDownloadTemplate = () => {
    const headers = ["Nome", "Máx Adultos", "Máx Crianças", "Observações", "Grupo/Família", "WhatsApp"];
    const exampleRow = ["João da Silva", 2, 1, "Alergia a camarão", "Família Silva", "+5521999999999"];
    const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    // Set column widths
    ws["!cols"] = [{ wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];
    // Format WhatsApp column as text
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: 5 })];
      if (cell) cell.t = "s";
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Convidados");
    XLSX.writeFile(wb, "modelo_convidados.xlsx");
  };

  const readFileWithEncoding = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Detect and strip BOM
    const hasBOM = uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF;
    const bytes = hasBOM ? uint8Array.slice(3) : uint8Array;

    // Try UTF-8 first
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      // Try Windows-1252 (covers ISO-8859-1 + common Excel BR)
      try {
        return new TextDecoder('windows-1252', { fatal: false }).decode(bytes);
      } catch {
        // Final fallback: MacRoman via macintosh encoding
        return new TextDecoder('macintosh', { fatal: false }).decode(bytes);
      }
    }
  };

  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const normalizeHeader = (header: string): string => {
    return header
      .trim()
      .toLowerCase()
      .replace(/^"|"$/g, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const findColumnIndex = (headers: string[], possibleNames: string[]): number => {
    const normalized = headers.map(normalizeHeader);
    const targets = possibleNames.map(normalizeHeader);

    for (const t of targets) {
      const idx = normalized.indexOf(t);
      if (idx !== -1) return idx;
    }
    for (const t of targets) {
      const idx = normalized.findIndex(h => h.startsWith(t));
      if (idx !== -1) return idx;
    }
    for (const t of targets) {
      const idx = normalized.findIndex(h => h.includes(t));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const parseNumericValue = (value: string | undefined): number => {
    if (!value || value.trim() === "") return 0;
    const cleaned = value.replace(/[^0-9.,\-]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.max(0, Math.min(Math.floor(num), 20));
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O arquivo deve ter no máximo 5MB.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv");

    if (!isExcel && !isCSV) {
      toast({ title: "Formato inválido", description: "Use arquivos .xlsx, .xls ou .csv", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let rows: Array<Record<string, unknown>> = [];

    try {
      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      } else {
        // CSV fallback with encoding handling
        const rawText = await readFileWithEncoding(file);
        const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          toast({ title: "Arquivo vazio", description: "O CSV não contém dados.", variant: "destructive" });
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const headerLine = lines[0];
        const semicolonCount = (headerLine.match(/;/g) || []).length;
        const commaCount = (headerLine.match(/,/g) || []).length;
        const delimiter = semicolonCount >= commaCount ? ";" : ",";
        const headerValues = parseCSVLine(headerLine, delimiter);

        const nameIdx = findColumnIndex(headerValues, ["nome", "name"]);
        const maxAdultsIdx = findColumnIndex(headerValues, ["max adultos", "max. adultos", "adultos"]);
        const maxChildrenIdx = findColumnIndex(headerValues, ["max criancas", "max. criancas", "criancas"]);
        const obsIdx = findColumnIndex(headerValues, ["observacoes", "observacao", "obs"]);
        const groupIdx = findColumnIndex(headerValues, ["grupo/familia", "grupo", "familia", "family"]);
        const whatsappIdx = findColumnIndex(headerValues, ["whatsapp", "telefone", "phone", "celular"]);

        for (const line of lines.slice(1)) {
          const values = parseCSVLine(line, delimiter);
          const row: Record<string, string> = {};
          if (nameIdx >= 0) row["Nome"] = values[nameIdx] || "";
          else row["Nome"] = values[0] || "";
          if (maxAdultsIdx >= 0) row["Máx Adultos"] = values[maxAdultsIdx] || "";
          else if (values[1]) row["Máx Adultos"] = values[1];
          if (maxChildrenIdx >= 0) row["Máx Crianças"] = values[maxChildrenIdx] || "";
          else if (values[2]) row["Máx Crianças"] = values[2];
          if (obsIdx >= 0) row["Observações"] = values[obsIdx] || "";
          if (groupIdx >= 0) row["Grupo/Família"] = values[groupIdx] || "";
          if (whatsappIdx >= 0) row["WhatsApp"] = values[whatsappIdx] || "";
          rows.push(row);
        }
      }
    } catch (err) {
      toast({ title: "Erro ao ler arquivo", description: "Não foi possível processar o arquivo.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (rows.length === 0) {
      toast({ title: "Arquivo vazio", description: "O arquivo não contém dados.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const MAX_IMPORTS = 500;
    if (rows.length > MAX_IMPORTS) {
      toast({ title: "Muitos registros", description: `Limite de ${MAX_IMPORTS} convidados por importação. Arquivo tem ${rows.length} linhas.`, variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Normalize headers for matching
    const normalizeKey = (k: string) => k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const findValue = (row: Record<string, unknown>, possibleNames: string[]): string => {
      const targets = possibleNames.map(normalizeKey);
      for (const key of Object.keys(row)) {
        if (targets.some(t => normalizeKey(key).includes(t))) {
          return String(row[key] ?? "").trim();
        }
      }
      return "";
    };

    let imported = 0;
    let errors = 0;
    let duplicates = 0;

    for (const row of rows) {
      const name = sanitizeCSVValue(findValue(row, ["nome", "name"]).replace(/^"|"$/g, ""));
      if (!name || name.length > 100) { errors++; continue; }

      const maxAdultsRaw = findValue(row, ["max adultos", "adultos"]);
      const maxChildrenRaw = findValue(row, ["max criancas", "criancas"]);
      const observations = sanitizeCSVValue(findValue(row, ["observacoes", "observacao", "obs"])) || null;
      const groupName = sanitizeCSVValue(findValue(row, ["grupo/familia", "grupo", "familia"])) || null;
      const whatsappRaw = findValue(row, ["whatsapp", "telefone", "phone", "celular"]);

      const maxAdults = parseNumericValue(maxAdultsRaw) || 1;
      const maxChildren = parseNumericValue(maxChildrenRaw);

      // Normalize WhatsApp: keep only digits and +
      let whatsapp: string | null = null;
      if (whatsappRaw) {
        const cleaned = whatsappRaw.replace(/[^0-9+]/g, "");
        if (cleaned.length >= 8) {
          whatsapp = cleaned.startsWith("+") ? cleaned : "+" + cleaned;
        }
      }

      const { error } = await supabase.from("guests").insert({
        event_id: eventId,
        name,
        max_adults: maxAdults,
        max_children: maxChildren,
        status: "pending",
        confirmed_adults: 0,
        confirmed_children: 0,
        observations,
        group_name: groupName,
        whatsapp,
      });

      if (error) {
        if (error.message?.includes("duplicate") || error.code === "23505") duplicates++;
        errors++;
      } else {
        imported++;
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";

    const parts = [`${imported} convidados importados`];
    if (duplicates > 0) parts.push(`${duplicates} duplicados ignorados`);
    if (errors - duplicates > 0) parts.push(`${errors - duplicates} erros`);

    toast({ title: "Importação concluída", description: parts.join(", ") + "." });
    fetchEventData();
  };

  return (
    <div className="font-grotesk">
      {/* Header */}
      <header className="flex items-center gap-5 px-5 md:px-10 py-5 border-b border-[#e6dccf] bg-[#f4eee5]/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <div className="hidden sm:flex items-center gap-[7px] text-[12.5px] text-[#b3a194] mb-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="hover:text-[#7a1b2a] transition-colors"
            >
              Eventos
            </button>
            <ChevronRight className="h-[13px] w-[13px]" />
            <span className="text-[#7a1b2a] font-semibold truncate">{event.name}</span>
          </div>
          <h1 className="font-serif font-semibold text-[22px] md:text-[28px] leading-none text-[#3a0a10] truncate">
            {event.name}
          </h1>
        </div>
        <div className="flex items-center gap-[10px] flex-none">
          <button
            onClick={() => setShareHostOpen(true)}
            className="flex items-center gap-2 bg-white text-[#4c0c14] border border-[#e6dccf] rounded-[11px] px-3 md:px-4 py-[10px] text-[13.5px] font-semibold hover:bg-[#fbf7f1] transition-colors"
          >
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Compartilhar com anfitrião</span>
          </button>
          <button
            onClick={() => window.open(`/confirmar/${event.id}`, "_blank")}
            className="flex items-center gap-2 bg-[#4c0c14] text-white rounded-[11px] px-3 md:px-4 py-[10px] text-[13.5px] font-semibold hover:bg-[#5e1019] transition-colors shadow-[0_6px_16px_-6px_rgba(76,12,20,.6)]"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden md:inline">Ver página</span>
          </button>
        </div>
      </header>

      <div className="px-5 md:px-10 py-7 max-w-[1180px] w-full mx-auto">
        {/* Stats Cards */}
        <EventStatsCards stats={stats} />

        {/* Actions */}
        <div className="flex items-center gap-[10px] flex-wrap mb-[18px]">
          <button
            className="flex items-center gap-[7px] bg-[#4c0c14] text-white rounded-[10px] px-4 py-[10px] text-[13.5px] font-semibold hover:bg-[#5e1019] transition-colors"
            onClick={() => setAddGuestOpen(true)}
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Convidado
          </button>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            className="flex items-center gap-[7px] bg-white text-[#5e3b32] border border-[#e6dccf] rounded-[10px] px-[14px] py-[10px] text-[13.5px] font-semibold hover:bg-[#fbf7f1] transition-colors"
            onClick={handleDownloadTemplate}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Modelo CSV</span>
          </button>
          <button
            className="flex items-center gap-[7px] bg-white text-[#5e3b32] border border-[#e6dccf] rounded-[10px] px-[14px] py-[10px] text-[13.5px] font-semibold hover:bg-[#fbf7f1] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-4 w-4" />
            <span className="hidden sm:inline">Importar CSV</span>
          </button>
          <div className="flex-1" />
          <button
            className="flex items-center gap-[7px] bg-white text-[#5e3b32] border border-[#e6dccf] rounded-[10px] px-[14px] py-[10px] text-[13.5px] font-semibold hover:bg-[#fbf7f1] transition-colors"
            onClick={handleExportConfirmed}
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar confirmados</span>
            <span className="sm:hidden">Confirmados</span>
          </button>
        </div>


      {/* Guest Table or Empty State */}
      {stats.total === 0 && !loading ? (
        <div className="bg-white border border-[#ece2d5] rounded-2xl p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-[#b3a194] mb-4" />
          <h3 className="font-serif text-xl font-semibold text-[#3a0a10] mb-2">
            Nenhum convidado ainda
          </h3>
          <p className="text-[#9a8478] mb-4">
            Adicione convidados manualmente ou importe um arquivo CSV
          </p>
          <button
            className="inline-flex items-center gap-2 bg-[#4c0c14] text-white rounded-[10px] px-4 py-[10px] text-[13.5px] font-semibold hover:bg-[#5e1019] transition-colors"
            onClick={() => setAddGuestOpen(true)}
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Adicionar Convidado
          </button>
        </div>
      ) : (
        <GuestTable 
          guests={guests} 
          eventId={eventId}
          eventName={event.name}
          eventDate={event.event_date}
          webhookUrl={event.webhook_url}
          onRefresh={fetchEventData}
          onEdit={(guest) => setEditGuest(guest)}
        />
      )}
      </div>


      {/* Add Guest Modal */}
      <AddGuestModal
        open={addGuestOpen}
        onOpenChange={setAddGuestOpen}
        eventId={eventId}
        onSuccess={fetchEventData}
      />

      {/* Edit Guest Modal */}
      <EditGuestModal
        open={!!editGuest}
        onOpenChange={(open) => !open && setEditGuest(null)}
        guest={editGuest}
        eventId={eventId}
        onSuccess={fetchEventData}
      />

      {/* Share Host Modal */}
      <ShareHostModal
        open={shareHostOpen}
        onOpenChange={setShareHostOpen}
        eventId={eventId}
        eventName={event.name}
        currentPassword={event.host_password}
        currentAllowEdit={event.allow_host_edit ?? false}
      />
    </div>
  );
};

export default EventManagement;
