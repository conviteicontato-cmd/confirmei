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
  QrCode,
  List,
  Search,
  ChevronRight,
  Check,
  Download,
  Camera,
  CameraOff,
  RefreshCw,
} from "lucide-react";
import { Json } from "@/integrations/supabase/types";
import CheckinDetailModal, { type CheckinGuest } from "./CheckinDetailModal";

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
  max_adults: number | null;
  max_children: number | null;
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
  const [selectedGuest, setSelectedGuest] = useState<CheckinGuest | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [scannerMessageType, setScannerMessageType] = useState<"success" | "error" | "info">("info");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const guestsRef = useRef<Guest[]>([]);
  guestsRef.current = guests;

  const fetchGuests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("guests")
        .select("id, name, status, confirmed_adults, confirmed_children, max_adults, max_children, checkin_done, checkin_at, qr_code, companions, children")
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

  // --- QR Scanner via native BarcodeDetector or manual canvas ---
  const handleQrResult = useCallback((qrCode: string) => {
    const now = Date.now();
    // Debounce: same QR within 5 seconds
    if (qrCode === lastScannedRef.current && now - lastScanTimeRef.current < 5000) {
      return;
    }
    lastScannedRef.current = qrCode;
    lastScanTimeRef.current = now;

    console.log("[checkin-scanner] QR lido:", qrCode, "evento:", eventId);

    // Try to find guest by qr_code
    const guest = guestsRef.current.find((g) => g.qr_code === qrCode);

    if (!guest) {
      // Check if QR looks valid (UUID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(qrCode)) {
        setScannerMessage("QR inválido.");
        setScannerMessageType("error");
        console.warn("[checkin-scanner] Formato inválido:", qrCode);
      } else {
        setScannerMessage("QR não encontrado para este evento.");
        setScannerMessageType("error");
        console.warn("[checkin-scanner] Não encontrado:", qrCode);
      }
      // Clear message after 3s
      setTimeout(() => setScannerMessage(null), 3000);
      return;
    }

    // Pause scanning
    pausedRef.current = true;
    setScannerMessage(`${guest.name} encontrado!`);
    setScannerMessageType("success");

    // Open modal
    setSelectedGuest(guest as CheckinGuest);

    // Resume scanning after modal closes (handled in modal close)
    setTimeout(() => {
      pausedRef.current = false;
      setScannerMessage(null);
    }, 2000);
  }, [eventId]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScannerMessage(null);

    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScannerActive(true);
        startScanning();
      }
    } catch (err: any) {
      console.error("[checkin-scanner] Camera error:", err);
      if (err.name === "NotAllowedError") {
        setCameraError("Permissão de câmera negada. Permita o acesso nas configurações do navegador.");
      } else if (err.name === "NotFoundError") {
        setCameraError("Nenhuma câmera encontrada no dispositivo.");
      } else if (err.name === "NotReadableError") {
        setCameraError("Câmera em uso por outro aplicativo.");
      } else {
        setCameraError("Erro ao acessar a câmera: " + err.message);
      }
    }
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const startScanning = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Use BarcodeDetector if available
    const hasBarcodeDetector = "BarcodeDetector" in window;
    let detector: any = null;
    if (hasBarcodeDetector) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        // fallback
      }
    }

    const scan = async () => {
      if (!video || video.readyState < 2 || pausedRef.current) {
        animFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      if (detector) {
        try {
          const barcodes = await detector.detect(canvas);
          if (barcodes.length > 0) {
            handleQrResult(barcodes[0].rawValue);
          }
        } catch {
          // ignore detection errors
        }
      }
      // If no BarcodeDetector, we rely on the html5-qrcode fallback below

      animFrameRef.current = requestAnimationFrame(scan);
    };

    animFrameRef.current = requestAnimationFrame(scan);
  }, [handleQrResult]);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScannerActive(false);
  }, []);

  // Start/stop camera when mode changes
  useEffect(() => {
    if (mode === "scanner") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  // Search in scanner mode
  const [scannerSearch, setScannerSearch] = useState("");
  const scannerSearchResults = scannerSearch.length >= 2
    ? guests.filter(g => g.name.toLowerCase().includes(scannerSearch.toLowerCase()))
    : [];

  const filteredGuests = guests.filter((guest) =>
    guest.name.toLowerCase().includes(search.toLowerCase())
  );

  // Export CSV
  const exportCheckinCSV = () => {
    const checkedInGuests = guests.filter(g => g.checkin_done);
    if (checkedInGuests.length === 0) {
      toast({ title: "Nenhum check-in realizado", description: "Não há convidados com check-in para exportar.", variant: "destructive" });
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
      companions.forEach(c => {
        if (c.checked_in) rows.push([c.name, "Acompanhante", "-", "Sim"]);
      });
      children.forEach(c => {
        if (c.checked_in) rows.push([c.name, "Criança", c.age || "-", "Sim"]);
      });
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `checkins-${eventName.replace(/[^a-zA-Z0-9]/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "CSV exportado", description: `${rows.length} pessoas com check-in exportadas.` });
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

  const GuestCheckinCard = ({ guest }: { guest: Guest }) => (
    <div
      className="card-elegant p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => setSelectedGuest(guest as CheckinGuest)}
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
          <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0">
            <Check className="h-3 w-3 mr-1" />
            Feito
          </Badge>
        ) : (
          <Button size="sm" className="btn-gold rounded-full" onClick={(e) => { e.stopPropagation(); setSelectedGuest(guest as CheckinGuest); }}>
            Check-in
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Breadcrumb */}
      <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <button onClick={() => navigate("/dashboard")} className="hover:text-foreground transition-colors">
          Eventos
        </button>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{eventName}</span>
      </div>

      {/* Header */}
      <div className="text-center mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-2">Check-in</h1>
        <p className="text-sm lg:text-base text-muted-foreground mb-4">
          Escaneie o QR Code ou busque o convidado
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-6 lg:mb-8">
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
          <button
            onClick={() => setMode("scanner")}
            className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "scanner" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner</span>
          </button>
          <button
            onClick={() => setMode("lista")}
            className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "lista" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
            <p className="text-xs text-muted-foreground mb-1">Total adultos</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">{stats.totalAdults}</p>
          </div>
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-muted flex items-center justify-center">
            <Users className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
          </div>
        </div>
        <div className="rounded-xl p-3 lg:p-4 bg-muted/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Total crianças</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">{stats.totalChildren}</p>
          </div>
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-muted flex items-center justify-center">
            <Baby className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
          </div>
        </div>
        <div className="rounded-xl p-3 lg:p-4 bg-green-500/10 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Check-ins</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">{stats.checkedIn}</p>
          </div>
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <UserCheck className="h-4 w-4 lg:h-5 lg:w-5 text-green-600" />
          </div>
        </div>
        <div className="rounded-xl p-3 lg:p-4 bg-muted/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Restantes</p>
            <p className="text-xl lg:text-2xl font-display font-bold text-foreground">{stats.remaining}</p>
          </div>
          <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-muted flex items-center justify-center">
            <Clock className="h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-center mb-6 lg:mb-8">
        <Button variant="outline" onClick={exportCheckinCSV} className="rounded-full" disabled={stats.checkedIn === 0}>
          <Download className="h-4 w-4 mr-2" />
          Baixar CSV de Check-ins
        </Button>
      </div>

      {/* Scanner Mode */}
      {mode === "scanner" && (
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Camera view */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-h-[400px]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scan overlay */}
            {scannerActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-2 border-primary/60 rounded-2xl" />
              </div>
            )}

            {/* Camera error */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-6 text-center">
                <CameraOff className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-white mb-4">{cameraError}</p>
                <Button onClick={startCamera} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* Scanner message overlay */}
            {scannerMessage && (
              <div className={`absolute bottom-4 left-4 right-4 p-3 rounded-lg text-center text-sm font-medium ${
                scannerMessageType === "success" ? "bg-green-500/90 text-white" :
                scannerMessageType === "error" ? "bg-red-500/90 text-white" :
                "bg-primary/90 text-primary-foreground"
              }`}>
                {scannerMessage}
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleCamera} className="rounded-full">
              <Camera className="h-4 w-4 mr-2" />
              {facingMode === "environment" ? "Câmera frontal" : "Câmera traseira"}
            </Button>
            {!scannerActive && !cameraError && (
              <Button size="sm" onClick={startCamera} className="rounded-full btn-gold">
                <Camera className="h-4 w-4 mr-2" />
                Iniciar câmera
              </Button>
            )}
          </div>

          {/* Manual search fallback in scanner mode */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">Ou busque manualmente:</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome do convidado..."
                value={scannerSearch}
                onChange={(e) => setScannerSearch(e.target.value)}
                className="pl-10 rounded-lg"
              />
            </div>
            {scannerSearchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {scannerSearchResults.map(guest => (
                  <div
                    key={guest.id}
                    className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-between"
                    onClick={() => {
                      setSelectedGuest(guest as CheckinGuest);
                      setScannerSearch("");
                    }}
                  >
                    <div>
                      <span className="font-medium text-foreground">{guest.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{guest.confirmed_adults || 0} adultos</span>
                        <span>{guest.confirmed_children || 0} crianças</span>
                      </div>
                    </div>
                    {guest.checkin_done ? (
                      <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0 text-xs">Feito</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Pendente</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
            {scannerSearch.length >= 2 && scannerSearchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Nenhum convidado encontrado.</p>
            )}
          </div>
        </div>
      )}

      {/* List Mode */}
      {mode === "lista" && (
        <div className="max-w-4xl mx-auto">
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
                      onClick={() => setSelectedGuest(guest as CheckinGuest)}
                    >
                      <TableCell className="font-medium">{guest.name}</TableCell>
                      <TableCell className="text-center">{guest.confirmed_adults || 0}</TableCell>
                      <TableCell className="text-center">{guest.confirmed_children || 0}</TableCell>
                      <TableCell className="text-center">
                        {guest.checkin_done ? (
                          <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-0">
                            <Check className="h-3 w-3 mr-1" />
                            Feito
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className={guest.checkin_done ? "" : "btn-gold"}
                          variant={guest.checkin_done ? "outline" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGuest(guest as CheckinGuest);
                          }}
                        >
                          {guest.checkin_done ? "Editar" : "Check-in"}
                        </Button>
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
        onOpenChange={(open) => {
          if (!open) {
            setSelectedGuest(null);
            pausedRef.current = false;
          }
        }}
        guest={selectedGuest}
        onSuccess={fetchGuests}
      />
    </div>
  );
};

export default CheckinPage;
