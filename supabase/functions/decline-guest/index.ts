import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DeclineGuestRequest {
  guest_id: string;
  event_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body: DeclineGuestRequest = await req.json();
    const { guest_id, event_id } = body;

    if (!guest_id || !event_id) {
      return new Response(
        JSON.stringify({ error: 'guest_id and event_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate guest belongs to the event
    const { data: guest, error: fetchError } = await supabase
      .from('guests')
      .select('id, event_id, status')
      .eq('id', guest_id)
      .eq('event_id', event_id)
      .single();

    if (fetchError || !guest) {
      return new Response(
        JSON.stringify({ error: 'Guest not found or does not belong to this event' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check confirmations are still open (manual + deadline)
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('confirmation_active, confirmation_deadline, auto_block')
      .eq('id', event_id)
      .single();

    if (eventError || !eventData) {
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (eventData.confirmation_active === false) {
      return new Response(
        JSON.stringify({ error: 'Confirmações encerradas para este evento' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (eventData.auto_block && eventData.confirmation_deadline) {
      if (new Date() > new Date(eventData.confirmation_deadline)) {
        return new Response(
          JSON.stringify({ error: 'Confirmações encerradas para este evento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Mark as declined and clear any prior confirmation data + participants
    const { error: updateError } = await supabase
      .from('guests')
      .update({
        status: 'declined',
        confirmed_adults: 0,
        confirmed_children: 0,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', guest_id)
      .eq('event_id', event_id);

    if (updateError) {
      console.error('[decline-guest] Update failed:', updateError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to register response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Remove individual participants/QR codes for this guest
    await supabase.from('guest_participants').delete().eq('guest_id', guest_id);

    console.log(`[decline-guest] Guest ${guest_id} declined for event ${event_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[decline-guest] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
