import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Baby,
  UserCheck,
  Clock,
  Camera,
  QrCode,
  List,
  Search,
  ChevronRight,
  Check,
  Download,
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Json } from "@/integrations/supabase/types";
import CheckinDetailModal from "./CheckinDetailModal";

interface CheckinPageProps {
  eventId: string;
  eventName: string;
}

interface Guest {
  id: string;
  name: string;
  status: string | null;
  confirmed_adults: number | null;
  confirmed_children: number | null;
  checkin_done: boolean | null;
  checkin_at: string | null;
  qr_code: string | null;
  companions: Json | null;
  children: Json | null;
}

interface Stats {
  totalAdults: number;
  totalChildren: number;
  checkedIn: number;
  remaining: number;
}

const CheckinPage = ({ eventId, eventName }: CheckinPageProps) => {
  const [mode, setMode] = useState<"scanner" | "lista">("scanner");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalAdults: 0,
    totalChildren: 0,
    checkedIn: 0,
    remaining: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  // We need a ref for guests so the scanner callback always has the latest list
  const guestsRef = useRef<Guest[]>([]);
  guestsRef.current = guests;

  const fetchGuests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("guests")
        .select("id, name, status, confirmed_adults, confirmed_children, checkin_done, checkin_at, qr_code, companions, children")
        .eq("event_id", eventId)
        .eq("status", "confirmed")
        .order("name");

      if (error) throw error;

      setGuests(data || []);

      const totalAdults = data?.reduce((acc, g) => acc + (g.confirmed_adults || 0), 0) || 0;
      const totalChildren = data?.reduce((acc, g) => acc + (g.confirmed_children || 0), 0) || 0;
      const checkedIn = data?.filter((g) => g.checkin_done).length || 0;
      const remaining = (data?.length || 0) - checkedIn;

      setStats({ totalAdults, totalChildren, checkedIn, remaining });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar convidados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  const handleQrCodeScan = useCallback((qrCode: string) => {
    const guest = guestsRef.current.find((g) => g.qr_code === qrCode);

    if (!guest) {
      toast({
        title: "QR Code inválido",
        description: "Este QR Code não corresponde a nenhum convidado.",
        variant: "destructive",
      });
      return;
    }

    setSelectedGuest(guest);
  }, [toast]);

  // Html5QrcodeScanner lifecycle via useEffect
  useEffect(() => {
    if (mode !== "scanner") return;

    // Small delay to ensure the DOM element is rendered
    const timeoutId = setTimeout(() => {
      if (scannerRef.current) return; // already initialized

      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true,
          aspectRatio: 1,
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText: string) => {
          handleQrCodeScan(decodedText);
          // Pause scanning after a successful read so it doesn't fire repeatedly
          scanner.pause(true);
          // Resume after 3 seconds so the user can scan the next guest
          setTimeout(() => {
            try {
              scanner.resume();
            } catch {
              // scanner may have been cleared
            }
          }, 3000);
        },
        (_errorMessage: string) => {
          // Scan errors are normal (no QR in frame), ignore
        }
      );

      scannerRef.current = scanner;
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
    };
  }, [mode, handleQrCodeScan]);

  const handleCheckin = async (guestId: string, guestName: string) => {
    setCheckingIn(guestId);
    try {
      const { error } = await supabase
        .from("guests")
        .update({
          checkin_done: true,
          checkin_at: new Date().toISOString(),
          qr_used: true,
        })
        .eq("id", guestId);

      if (error) throw error;

      toast({
        title: "Check-in realizado!",
        description: `${guestName} foi registrado com sucesso.`,
      });
      fetchGuests();
    } catch (error: any) {
      toast({
        title: "Erro no check-in",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCheckingIn(null);
    }
  };

  const filteredGuests = guests.filter((guest) =>
    guest.name.toLowerCase().includes(search.toLowerCase())
  );

  // Export checked-in guests to CSV
  const exportCheckinCSV = () => {
    const checkedInGuests = guests.filter(g => g.checkin_done);
    
    if (checkedInGuests.length === 0) {
      toast({
        title: "Nenhum check-in realizado",
        description: "Não há convidados com check-in para exportar.",
        variant: "destructive",
      });
      return;
    }

    const parseCompanions = (json: Json | null): { name: string; checked_in?: boolean }[] => {
      if (!json || !Array.isArray(json)) return [];
      return json as unknown as { name: string; checked_in?: boolean }[];
    };

    const parseChildren = (json: Json | null): { name: string; age?: string; checked_in?: boolean }[] => {
      if (!json || !Array.isArray(json)) return [];
      return json as unknown as { name: string; age?: string; checked_in?: boolean }[];
    };

    const headers = ["Convidado", "Tipo", "Idade", "Check-in"];
    const rows: string[][] = [];

    checkedInGuests.forEach(guest => {
      const companions = parseCompanions(guest.companions);
      const children = parseChildren(guest.children);

      rows.push([guest.name, "Titular", "-", "Sim"]);

      companions.forEach(companion => {
        if (companion.checked_in) {
          rows.push([companion.name, "Acompanhante", "-", "Sim"]);
        }
      });

      children.forEach(child => {
        if (child.checked_in) {
          rows.push([child.name, "Criança", child.age || "-", "Sim"]);
        }
      });
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `checkins-${eventName.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exportado",
      description: `${rows.length} pessoas com check-in exportadas.`,
    });
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-8">
        <Skeleton className="h-4 w-48 mb-4" />
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="grid grid-cols-2 gap-3 lg:gap-4 max-w-2xl mx-auto mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl max-w-2xl mx-auto" />
      </div>
    );
  }

  // Mobile Guest Card for List Mode
  const GuestCheckinCard = ({ guest }: { guest: Guest }) => (
    <div 
      className="card-elegant p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => setSelectedGuest(guest)}
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground truncate">{guest.name}</h3>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {guest.confirmed_adults || 0}
          </span>
          <span className="flex items-center gap-1">
            <Baby className="h-3 w-3" />
            {guest.confirmed_children || 0}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {guest.checkin_done ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedGuest(guest);
            }}
          >
            Editar
          </Button>
        ) : (
          <Button
            size="sm"
            className="btn-gold rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedGuest(guest);
            }}
            disabled={checkingIn === guest.id}
          >
            {checkingIn === guest.id ? "..." : "Check-in"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Breadcrumb */}
      <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="hover:text-foreground transition-colors"
        >
          Eventos
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{eventName}</span>
      </div>

      {/* Header */}
      <div className="text-center mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">
          Check-in
        </h1>
        <p className="text-sm lg:text-base text-muted-foreground mb-4">
          Escaneie o QR Code na entrada do evento
        </p>
        <Badge className="bg-primary text-primary-foreground">
          <QrCode className="h-3 w-3 mr-1" />
          Modo: Leitor de QR Code
        </Badge>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-6 lg:mb-8">
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
          <button
            onClick={() => setMode("scanner")}
            className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "scanner"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner</span>
          </button>
          <button
            onClick={() => setMode("lista")}
            className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "lista"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:gap-4 max-w-2xl mx-auto mb-6 lg:mb-8">
        <div className="rounded-xl p-3 lg:p-4 bg-muted/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total de adultos</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">
              {stats.totalAdults}
            </p>
          </div>
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-muted flex items-center justify-center">
            <Users className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-xl p-3 lg:p-4 bg-muted/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total de crianças</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">
              {stats.totalChildren}
            </p>
          </div>
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-muted flex items-center justify-center">
            <Baby className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-xl p-3 lg:p-4 bg-success-muted flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Check-ins</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">
              {stats.checkedIn}
            </p>
          </div>
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-success/20 flex items-center justify-center">
            <UserCheck className="h-4 w-4 lg:h-5 lg:w-5 text-success" />
          </div>
        </div>

        <div className="rounded-xl p-3 lg:p-4 bg-muted/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Restantes</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">
              {stats.remaining}
            </p>
          </div>
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-muted flex items-center justify-center">
            <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-center mb-6 lg:mb-8">
        <Button
          variant="outline"
          onClick={exportCheckinCSV}
          className="rounded-full"
          disabled={stats.checkedIn === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar CSV de Check-ins
        </Button>
      </div>

      {/* Scanner Mode */}
      {mode === "scanner" && (
        <div className="max-w-2xl mx-auto">
          <div id="qr-reader" className="w-full min-h-[300px] bg-black rounded-xl overflow-hidden" />
        </div>
      )}

      {/* List Mode */}
      {mode === "lista" && (
        <div className="max-w-4xl mx-auto">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar convidado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>

          {/* Mobile Guest List */}
          <div className="lg:hidden space-y-3">
            {filteredGuests.length === 0 ? (
              <div className="card-elegant p-8 text-center text-muted-foreground">
                {search ? "Nenhum convidado encontrado" : "Nenhum convidado confirmado"}
              </div>
            ) : (
              filteredGuests.map((guest) => (
                <GuestCheckinCard key={guest.id} guest={guest} />
              ))
            )}
          </div>

          {/* Desktop Guest List */}
          <div className="hidden lg:block card-elegant overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-center">Adultos</TableHead>
                  <TableHead className="text-center">Crianças</TableHead>
                  <TableHead className="text-center">Check-in</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {search ? "Nenhum convidado encontrado" : "Nenhum convidado confirmado"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGuests.map((guest) => (
                    <TableRow 
                      key={guest.id} 
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelectedGuest(guest)}
                    >
                      <TableCell className="font-medium">
                        <span>{guest.name}</span>
                      </TableCell>
                      <TableCell className="text-center">{guest.confirmed_adults || 0}</TableCell>
                      <TableCell className="text-center">{guest.confirmed_children || 0}</TableCell>
                      <TableCell className="text-center">
                        {guest.checkin_done ? (
                          <Badge className="bg-success/20 text-success hover:bg-success/30 border-0">
                            <Check className="h-3 w-3 mr-1" />
                            Feito
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {guest.checkin_done ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGuest(guest);
                            }}
                          >
                            Editar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="btn-gold rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGuest(guest);
                            }}
                            disabled={checkingIn === guest.id}
                          >
                            {checkingIn === guest.id ? "..." : "Check-in"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-12 text-sm text-muted-foreground">
        © 2027 Convitei. Todos os direitos reservados.
      </div>

      {/* Check-in Detail Modal */}
      <CheckinDetailModal
        open={!!selectedGuest}
        onOpenChange={(open) => !open && setSelectedGuest(null)}
        guest={selectedGuest}
        onSuccess={fetchGuests}
      />
    </div>
  );
};

export default CheckinPage;
