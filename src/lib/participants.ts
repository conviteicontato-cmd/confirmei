import { supabase } from "@/integrations/supabase/client";

interface ParticipantInput {
  eventId: string;
  guestId: string;
  guestName: string;
  confirmedAdults: number;
  confirmedChildren: number;
  companions: Array<{ name: string }>;
  children: Array<{ name: string; age?: string }>;
  qrChildren: boolean;
}

export async function syncParticipants(input: ParticipantInput) {
  const { eventId, guestId, guestName, confirmedAdults, confirmedChildren, companions, children, qrChildren } = input;

  // Delete existing participants for this guest
  await supabase.from("guest_participants").delete().eq("guest_id", guestId);

  const participants: Array<{
    event_id: string;
    guest_id: string;
    name: string | null;
    type: "main" | "adult" | "child";
    age: string | null;
  }> = [];

  // Main guest
  participants.push({ event_id: eventId, guest_id: guestId, name: guestName, type: "main", age: null });

  // Adult companions
  const adultCount = Math.max(0, (confirmedAdults || 1) - 1); // minus the main guest
  for (let i = 0; i < adultCount; i++) {
    const companion = companions[i];
    participants.push({
      event_id: eventId,
      guest_id: guestId,
      name: companion?.name || `Acompanhante ${i + 1}`,
      type: "adult",
      age: null,
    });
  }

  // Children (if enabled)
  if (qrChildren) {
    const childCount = confirmedChildren || 0;
    for (let i = 0; i < childCount; i++) {
      const child = children[i];
      participants.push({
        event_id: eventId,
        guest_id: guestId,
        name: child?.name || `Criança ${i + 1}`,
        type: "child",
        age: null,
      });
    }
  }

  if (participants.length > 0) {
    const { error } = await supabase.from("guest_participants").insert(participants);
    if (error) console.error("Error syncing participants:", error);
  }
}

export async function getParticipantsForGuest(guestId: string) {
  const { data, error } = await supabase
    .from("guest_participants")
    .select("*")
    .eq("guest_id", guestId)
    .order("type");
  if (error) {
    console.error("Error fetching participants:", error);
    return [];
  }
  return data || [];
}

export async function checkinParticipant(participantId: string) {
  const { data, error } = await supabase
    .from("guest_participants")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", participantId)
    .is("checked_in_at", null)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return { success: false, message: "Este participante já fez check-in." };
    }
    return { success: false, message: error.message };
  }
  return { success: true, participant: data };
}

export async function findParticipantByQrCode(qrCode: string) {
  const { data, error } = await supabase
    .from("guest_participants")
    .select("*, guests!inner(name, event_id)")
    .eq("qr_code", qrCode)
    .single();

  if (error) return null;
  return data;
}
