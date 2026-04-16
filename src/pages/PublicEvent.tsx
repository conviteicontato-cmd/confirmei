import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, User, ArrowLeft, Minus, Plus, Users, Baby, Share2, CheckCircle2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";

interface EventData {
  id: string;
  name: string;
  event_date: string;
  short_message: string | null;
  cover_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  confirmation_active: boolean | null;
  confirmation_deadline: string | null;
  auto_block: boolean | null;
}

interface GuestData {
  id: string;
  name: string;
  max_adults: number | null;
  max_children: number | null;
  confirmed_adults: number | null;
  confirmed_children: number | null;
  status: string | null;
  qr_code: string | null;
  confirmed_at: string | null;
  whatsapp: string | null;
}

interface Participant {
  id: string;
  name: string | null;
  type: string;
  age: string | null;
  qr_code: string;
  checked_in_at: string | null;
}

type PageState = "search" | "confirm" | "whatsapp" | "success";

const PublicEvent = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GuestData[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestData | null>(null);
  const [pageState, setPageState] = useState<PageState>("search");
  const [saving, setSaving] = useState(false);
   const qrRef = useRef<HTMLDivElement>(null);

  // Confirmation form state
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [childrenAges, setChildrenAges] = useState<string[]>([]);
  const [companionNames, setCompanionNames] = useState<string[]>([]);
  const [childrenNames, setChildrenNames] = useState<string[]>([]);
  const [whatsappInput, setWhatsappInput] = useState("");
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);

  const { toast } = useToast();

   const downloadQRCode = async () => {
     if (!qrRef.current) return;
     
     const canvas = qrRef.current.querySelector("canvas");
     if (!canvas) return;

     try {
       const dataUrl = canvas.toDataURL("image/png");
       
       // Create download link
       const link = document.createElement("a");
       link.download = `qrcode-${selectedGuest?.name.replace(/\s+/g, "-")}.png`;
       link.href = dataUrl;
       link.click();
       
       toast({
         title: "QR Code salvo!",
         description: "Verifique sua pasta de downloads.",
       });
     } catch (err) {
       console.error("Download error:", err);
       toast({
         title: "Erro ao salvar",
         description: "Tente fazer uma captura de tela.",
         variant: "destructive",
       });
     }
   };

   const shareQRCode = async () => {
     if (!qrRef.current || !event) return;
     
     const canvas = qrRef.current.querySelector("canvas");
     if (!canvas) return;

     try {
       // Convert canvas to blob
       const blob = await new Promise<Blob>((resolve, reject) => {
         canvas.toBlob((blob) => {
           if (blob) resolve(blob);
           else reject(new Error("Failed to create blob"));
         }, "image/png");
       });

       const file = new File([blob], `qrcode-${selectedGuest?.name}.png`, { type: "image/png" });

       if (navigator.canShare && navigator.canShare({ files: [file] })) {
         await navigator.share({
           title: `Confirmação - ${event.name}`,
           text: `Minha confirmação de presença para ${event.name} em ${formattedDate}`,
           files: [file],
         });
       } else if (navigator.share) {
         await navigator.share({
           title: `Confirmação - ${event.name}`,
           text: `Minha confirmação de presença para ${event.name} em ${formattedDate}`,
           url: window.location.href,
         });
       } else {
         // Fallback to download
         downloadQRCode();
       }
     } catch (err: any) {
       if (err.name !== "AbortError") {
         console.error("Share error:", err);
         // Fallback to download
         downloadQRCode();
       }
     }
   };

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;

      try {
        // Use the public_events view which excludes sensitive fields like host_email
         const { data, error } = await supabase
          .from("public_events")
          .select("id, name, event_date, short_message, cover_image_url, primary_color, secondary_color, confirmation_active, confirmation_deadline, auto_block")
          .eq("id", eventId)
          .maybeSingle();

        if (error) throw error;
        setEvent(data);
      } catch (error: any) {
        console.error("Error fetching event:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    const searchGuests = async () => {
      if (!eventId || searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
         const { data, error } = await supabase
          .from("guests")
          .select("id, name, max_adults, max_children, confirmed_adults, confirmed_children, status, qr_code, confirmed_at, whatsapp")
          .eq("event_id", eventId)
          .ilike("name", `%${searchQuery}%`)
          .limit(10);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (error: any) {
        console.error("Error searching guests:", error);
      }
    };

    const debounce = setTimeout(searchGuests, 300);
    return () => clearTimeout(debounce);
  }, [eventId, searchQuery]);

  // Check if confirmations are closed for this event
  const isConfirmationsClosed = event ? (
    event.confirmation_active === false ||
    (event.auto_block === true && event.confirmation_deadline && new Date() > new Date(event.confirmation_deadline))
  ) : false;

  const fetchParticipants = async (guestId: string) => {
    const { data } = await supabase
      .from("guest_participants")
      .select("id, name, type, age, qr_code, checked_in_at")
      .eq("guest_id", guestId)
      .order("type");
    setParticipants(data || []);
  };

  const handleSelectGuest = (guest: GuestData) => {
    setSelectedGuest(guest);
    setValidationErrors({});
    if (guest.status === 'confirmed') {
      setAdults((guest.confirmed_adults || 1) - 1);
      setChildren(guest.confirmed_children || 0);
      fetchParticipants(guest.id);
      setPageState("success");
      return;
    }
    setAdults(0);
    setChildren(0);
    setChildrenAges([]);
    setCompanionNames([]);
    setChildrenNames([]);
    setParticipants([]);
    setPageState("confirm");
  };

  const handleBack = () => {
    setSelectedGuest(null);
    setPageState("search");
  };

  const handleAdultsChange = (newValue: number) => {
    const maxAdultsCount = selectedGuest?.max_adults || 0;
    const clampedValue = Math.max(0, Math.min(newValue, maxAdultsCount));
    setAdults(clampedValue);
    
    // Adjust companion names array
    if (clampedValue > companionNames.length) {
      setCompanionNames([...companionNames, ...Array(clampedValue - companionNames.length).fill("")]);
    } else {
      setCompanionNames(companionNames.slice(0, clampedValue));
    }
  };

  const handleCompanionNameChange = (index: number, value: string) => {
    const newNames = [...companionNames];
    newNames[index] = value;
    setCompanionNames(newNames);
  };

  const handleChildrenChange = (newValue: number) => {
    const maxChildren = selectedGuest?.max_children || 0;
    const clampedValue = Math.max(0, Math.min(newValue, maxChildren));
    setChildren(clampedValue);
    
    // Adjust ages array
    if (clampedValue > childrenAges.length) {
      setChildrenAges([...childrenAges, ...Array(clampedValue - childrenAges.length).fill("")]);
      setChildrenNames([...childrenNames, ...Array(clampedValue - childrenNames.length).fill("")]);
    } else {
      setChildrenAges(childrenAges.slice(0, clampedValue));
      setChildrenNames(childrenNames.slice(0, clampedValue));
    }
  };

  const handleChildNameChange = (index: number, value: string) => {
    const newNames = [...childrenNames];
    newNames[index] = value;
    setChildrenNames(newNames);
  };

  const handleChildAgeChange = (index: number, value: string) => {
    const newAges = [...childrenAges];
    newAges[index] = value;
    setChildrenAges(newAges);
  };

  const handleProceedToWhatsApp = () => {
    // Validate companion names
    const errors: Record<string, string> = {};
    for (let i = 0; i < adults; i++) {
      if (!companionNames[i]?.trim()) {
        errors[`companion_${i}`] = "Informe o nome do acompanhante.";
      }
    }
    for (let i = 0; i < children; i++) {
      if (!childrenNames[i]?.trim()) {
        errors[`child_name_${i}`] = "Informe o nome da criança.";
      }
      if (!childrenAges[i]?.trim()) {
        errors[`child_age_${i}`] = "Informe a idade da criança.";
      } else {
        const ageNum = parseInt(childrenAges[i], 10);
        if (isNaN(ageNum) || ageNum < 0 || ageNum > 17) {
          errors[`child_age_${i}`] = "Idade inválida (0-17).";
        }
      }
    }
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (selectedGuest?.whatsapp) {
      setWhatsappInput(selectedGuest.whatsapp);
      setWhatsappConfirmed(false);
    } else {
      setWhatsappInput("");
      setWhatsappConfirmed(false);
    }
    setPageState("whatsapp");
  };

  const handleConfirmWhatsApp = (keepExisting: boolean) => {
    if (keepExisting && selectedGuest?.whatsapp) {
      setWhatsappInput(selectedGuest.whatsapp);
    }
    setWhatsappConfirmed(true);
  };

  const handleConfirm = async () => {
    if (!selectedGuest || !eventId) return;

    // Normalize whatsapp
    const normalizedWa = whatsappInput ? whatsappInput.replace(/[^0-9+]/g, "") : null;

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('confirm-guest', {
        body: {
          guest_id: selectedGuest.id,
          event_id: eventId,
          confirmed_adults: adults + 1,
          confirmed_children: children,
          children: children > 0 ? childrenNames.map((name, i) => ({ index: i + 1, name, age: childrenAges[i] || "" })) : [],
          companions: adults > 0 ? companionNames.map((name, i) => ({ index: i + 1, name })) : [],
          whatsapp: normalizedWa,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Fetch individual participants with QR codes
      await fetchParticipants(selectedGuest.id);
      setPageState("success");
    } catch (error: any) {
      toast({
        title: "Erro ao confirmar",
        description: error.message || "Não foi possível confirmar sua presença. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Evento não encontrado</h1>
          <p className="text-muted-foreground">O evento que você procura não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const primaryColor = event.primary_color || "#D4AF37";
  const secondaryColor = event.secondary_color || "#FDF8F3";

  const formattedDate = format(new Date(event.event_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

  const totalPeople = (adults + 1) + children;
  const maxAdults = selectedGuest?.max_adults || 0;
  const maxChildren = selectedGuest?.max_children || 0;

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: secondaryColor }}
    >
      {/* Cover Image Header */}
      {event.cover_image_url && (
        <div className="relative w-full overflow-hidden" style={{ maxHeight: "40vh" }}>
          <img
            src={event.cover_image_url}
            alt={event.name}
            className="w-full h-full object-cover"
          />
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to bottom, transparent 50%, ${secondaryColor} 100%)`
            }}
          />
        </div>
      )}

      {/* Event Title */}
      <div className="text-center px-4 py-8 relative z-10">
        <h1 
          className="text-3xl md:text-4xl font-display font-bold mb-2"
          style={{ color: "#1a1a1a" }}
        >
          {event.name}
        </h1>
        <p className="text-lg text-muted-foreground">{formattedDate}</p>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 pb-12">
        {pageState === "search" && isConfirmationsClosed && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-muted">
              <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">
              Confirmações encerradas
            </h2>
            <p className="text-muted-foreground">
              O período de confirmação para este evento foi encerrado.
            </p>
          </div>
        )}

        {pageState === "search" && !isConfirmationsClosed && (
          <div className="space-y-6">
            <div className="text-center">
              <p 
                className="text-lg font-medium"
                style={{ color: primaryColor }}
              >
                {event.short_message || "Confirme sua presença ✨"}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digite seu primeiro nome"
                className="pl-12 h-14 text-lg rounded-xl border-2 transition-colors"
                style={{
                  borderColor: searchQuery.length > 0 ? primaryColor : "#e5e7eb",
                  backgroundColor: "white",
                }}
              />
            </div>

            {/* Search Feedback */}
            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <p className="text-center text-muted-foreground">
                Digite pelo menos 2 caracteres para pesquisar
              </p>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="text-center space-y-2">
                <p className="font-medium text-foreground">
                  Não encontramos seu nome na lista.
                </p>
                <p className="text-sm text-muted-foreground">
                  Verifique se está igual ao convite ou entre em contato com o organizador.
                </p>
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-center text-muted-foreground">
                  Encontramos {searchResults.length} resultado{searchResults.length > 1 ? "s" : ""} :
                </p>
                
                {searchResults.map((guest) => (
                  <div
                    key={guest.id}
                    className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      >
                        <User className="h-5 w-5" style={{ color: primaryColor }} />
                      </div>
                      <span className="font-medium text-foreground">{guest.name}</span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleSelectGuest(guest)}
                      className="rounded-full"
                    >
                      Sou eu
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {pageState === "confirm" && selectedGuest && !isConfirmationsClosed && (
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>

            {/* Confirmation Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-display font-bold text-foreground">
                  Olá, {selectedGuest.name.split(" ")[0]} !
                </h2>
              </div>

              {/* Adults Section */}
              {maxAdults > 0 && (
                <div className="space-y-3 pb-4 border-b">
                  <p className="text-center text-muted-foreground">
                    Você tem direito a <strong className="text-foreground">{maxAdults} acompanhante{maxAdults > 1 ? "s" : ""} adulto{maxAdults > 1 ? "s" : ""}</strong>
                  </p>
                  <p className="text-center text-sm text-muted-foreground">
                    Quantos acompanhantes (adultos) irão com você?
                  </p>
                  
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => handleAdultsChange(adults - 1)}
                      disabled={adults === 0}
                      className="w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-30"
                      style={{ borderColor: primaryColor }}
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="text-3xl font-bold w-12 text-center">{adults}</span>
                    <button
                      onClick={() => handleAdultsChange(adults + 1)}
                      disabled={adults >= maxAdults}
                      className="w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-30"
                      style={{ borderColor: primaryColor }}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Companion Names */}
                  {adults > 0 && (
                    <div className="space-y-3 pt-3">
                      <p className="text-center text-sm text-muted-foreground">
                        Informe o nome de cada acompanhante
                      </p>
                      {companionNames.map((name, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground w-28">Acompanhante {index + 1}:</span>
                            <Input
                              value={name}
                              onChange={(e) => handleCompanionNameChange(index, e.target.value)}
                              placeholder="Nome completo"
                              className={`flex-1 ${validationErrors[`companion_${index}`] ? "border-red-500" : ""}`}
                              maxLength={100}
                            />
                          </div>
                          {validationErrors[`companion_${index}`] && (
                            <p className="text-xs text-red-500 ml-[7.5rem]">{validationErrors[`companion_${index}`]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Children Section */}
              {maxChildren > 0 && (
                <div className="space-y-3 pb-4 border-b">
                  <p className="text-center text-muted-foreground">
                    Você pode levar até <strong className="text-foreground">{maxChildren} criança{maxChildren > 1 ? "s" : ""}</strong>
                  </p>
                  <p className="text-center text-sm text-muted-foreground">
                    Quantas crianças irão com você?
                  </p>
                  
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => handleChildrenChange(children - 1)}
                      disabled={children === 0}
                      className="w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-30"
                      style={{ borderColor: primaryColor }}
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="text-3xl font-bold w-12 text-center">{children}</span>
                    <button
                      onClick={() => handleChildrenChange(children + 1)}
                      disabled={children >= maxChildren}
                      className="w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors disabled:opacity-30"
                      style={{ borderColor: primaryColor }}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="space-y-2 text-center text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Adultos ( ) você: {adults + 1}</span>
                </div>
                {maxChildren > 0 && (
                  <div className="flex items-center justify-center gap-2">
                    <Baby className="h-4 w-4" />
                    <span>Crianças: {children}</span>
                  </div>
                )}
                <p className="font-medium text-foreground">Total de pessoas: {totalPeople}</p>
              </div>

              {/* Children Ages */}
              {children > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <p className="text-center text-sm text-muted-foreground">
                    Informe o nome e idade de cada criança
                  </p>
                  {childrenNames.map((name, index) => (
                    <div key={index} className="space-y-2">
                      <span className="text-sm font-medium text-foreground">Criança {index + 1}</span>
                      <div>
                        <Input
                          value={name}
                          onChange={(e) => handleChildNameChange(index, e.target.value)}
                          placeholder="Nome da criança"
                          className={`w-full ${validationErrors[`child_name_${index}`] ? "border-red-500" : ""}`}
                          maxLength={100}
                        />
                        {validationErrors[`child_name_${index}`] && (
                          <p className="text-xs text-red-500 mt-1">{validationErrors[`child_name_${index}`]}</p>
                        )}
                      </div>
                      <div>
                        <Input
                          value={childrenAges[index] || ""}
                          onChange={(e) => handleChildAgeChange(index, e.target.value)}
                          placeholder="Idade (ex: 5)"
                          className={`w-full ${validationErrors[`child_age_${index}`] ? "border-red-500" : ""}`}
                          maxLength={2}
                          type="number"
                          min="0"
                          max="17"
                        />
                        {validationErrors[`child_age_${index}`] && (
                          <p className="text-xs text-red-500 mt-1">{validationErrors[`child_age_${index}`]}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Next: WhatsApp Step */}
              <Button
                onClick={handleProceedToWhatsApp}
                className="w-full h-14 text-lg font-semibold rounded-xl text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* WhatsApp Step */}
        {pageState === "whatsapp" && selectedGuest && !isConfirmationsClosed && (
          <div className="space-y-6">
            <button
              onClick={() => setPageState("confirm")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>

            <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
              <div className="text-center">
                <Phone className="h-8 w-8 mx-auto mb-3" style={{ color: primaryColor }} />
                <h2 className="text-xl font-display font-bold text-foreground">
                  Seu WhatsApp
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Para que o organizador possa entrar em contato
                </p>
              </div>

              {selectedGuest.whatsapp && !whatsappConfirmed ? (
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground">
                    Este ainda é seu número de WhatsApp?
                  </p>
                  <div className="text-center text-lg font-medium text-foreground py-3 px-4 rounded-lg bg-muted/50">
                    {selectedGuest.whatsapp}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-12 rounded-xl"
                      onClick={() => {
                        setWhatsappInput("");
                        setWhatsappConfirmed(true);
                      }}
                    >
                      Não, atualizar
                    </Button>
                    <Button
                      className="h-12 rounded-xl text-white"
                      style={{ backgroundColor: primaryColor }}
                      onClick={() => handleConfirmWhatsApp(true)}
                    >
                      Sim, é esse
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {whatsappConfirmed && whatsappInput === "" && (
                    <p className="text-center text-sm text-muted-foreground">Informe seu novo número:</p>
                  )}
                  {!selectedGuest.whatsapp && !whatsappConfirmed && (
                    <p className="text-center text-sm text-muted-foreground">Informe seu número de WhatsApp com código do país:</p>
                  )}
                  <Input
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    placeholder="+55 21 99999-9999"
                    className="h-14 text-lg text-center rounded-xl"
                    type="tel"
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    Inclua o código do país. Ex: +55 para Brasil
                  </p>
                </div>
              )}

              <Button
                onClick={handleConfirm}
                disabled={saving || (!whatsappInput && !selectedGuest.whatsapp)}
                className="w-full h-14 text-lg font-semibold rounded-xl text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Confirmar Presença"
                )}
              </Button>
            </div>
          </div>
        )}

        {pageState === "success" && selectedGuest && (
          <div className="text-center space-y-6">
            {/* Success Icon */}
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-green-100">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-2">
                {selectedGuest.confirmed_at ? "Sua presença já foi registrada" : "Presença Confirmada!"}
              </h2>
              <p className="text-muted-foreground">
                {participants.length > 1
                  ? `Apresente os ${participants.length} QR Codes na entrada do evento`
                  : "Apresente este QR Code na entrada do evento"}
              </p>
            </div>

            {/* Event Info */}
            <div className="text-center">
              <h3 className="font-display font-bold text-lg text-foreground">
                {event.name}
              </h3>
              <p className="text-sm text-muted-foreground">{formattedDate}</p>
            </div>

            {/* Individual QR Codes */}
            {participants.length > 0 ? (
              <div className="space-y-4">
                {participants.map((participant) => (
                  <div key={participant.id} className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
                    <div className="flex justify-center py-3 bg-white">
                      <QRCodeCanvas
                        value={participant.qr_code}
                        size={160}
                        level="H"
                        includeMargin={true}
                        bgColor="#ffffff"
                      />
                    </div>
                    <div className="text-center border-t pt-3">
                      <p className="font-medium text-foreground text-lg">
                        {participant.name || "Participante"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {participant.type === "main" ? "Convidado Principal" : participant.type === "adult" ? "Acompanhante" : "Criança"}
                        {participant.age ? ` — ${participant.age} anos` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback: single QR code from guest record */
              <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                <div ref={qrRef} className="flex justify-center py-4 bg-white">
                  <QRCodeCanvas
                    value={selectedGuest.qr_code || selectedGuest.id}
                    size={180}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                  />
                </div>
                <div className="text-left border-t pt-4">
                  <p className="font-medium text-foreground">{selectedGuest.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {adults + 1} adulto{adults + 1 > 1 ? "s" : ""}
                  </p>
                  {children > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {children} criança{children > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Save hint */}
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              💡 Salve os QR Codes para apresentar na entrada
            </p>

            {/* Share Button */}
            <Button
              variant="outline"
              className="w-full h-12 text-base rounded-xl"
              onClick={shareQRCode}
            >
              <Share2 className="h-5 w-5 mr-2" />
              Compartilhar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicEvent;
