import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface ConfirmGuestRequest {
  guest_id: string;
  event_id: string;
  confirmed_adults: number;
  confirmed_children: number;
  companions: Array<{ index: number; name: string }>;
  children: Array<{ index: number; name: string; age: string }>;
  whatsapp?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body: ConfirmGuestRequest = await req.json();
    const { guest_id, event_id, confirmed_adults, confirmed_children, companions, children, whatsapp } = body;

    console.log(`[confirm-guest] Processing confirmation for guest ${guest_id} in event ${event_id}`);

    // Validate required fields
    if (!guest_id || !event_id) {
      console.error('[confirm-guest] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'guest_id and event_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate guest exists and belongs to the event
    const { data: guest, error: fetchError } = await supabase
      .from('guests')
      .select('id, event_id, status, max_adults, max_children, qr_code')
      .eq('id', guest_id)
      .eq('event_id', event_id)
      .single();

    if (fetchError || !guest) {
      console.error('[confirm-guest] Guest not found:', fetchError?.message);
      return new Response(
        JSON.stringify({ error: 'Guest not found or does not belong to this event' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block duplicate confirmation
    if (guest.status === 'confirmed') {
      console.log(`[confirm-guest] Guest ${guest_id} already confirmed`);
      return new Response(
        JSON.stringify({ error: 'Presença já registrada' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if confirmations are open for this event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('confirmation_active, confirmation_deadline, auto_block')
      .eq('id', event_id)
      .single();

    if (eventError || !eventData) {
      console.error('[confirm-guest] Event not found:', eventError?.message);
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check manual block
    if (eventData.confirmation_active === false) {
      console.log(`[confirm-guest] Confirmations disabled for event ${event_id}`);
      return new Response(
        JSON.stringify({ error: 'Confirmações encerradas para este evento' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check auto block by deadline
    if (eventData.auto_block && eventData.confirmation_deadline) {
      const deadline = new Date(eventData.confirmation_deadline);
      if (new Date() > deadline) {
        console.log(`[confirm-guest] Confirmation deadline passed for event ${event_id}`);
        return new Response(
          JSON.stringify({ error: 'Confirmações encerradas para este evento' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate counts against limits
    const validatedAdults = Math.max(1, Math.min(confirmed_adults, (guest.max_adults || 0) + 1));
    const validatedChildren = Math.max(0, Math.min(confirmed_children, guest.max_children || 0));

    console.log(`[confirm-guest] Validated counts - Adults: ${validatedAdults}, Children: ${validatedChildren}`);

    // Sanitize companion and children names (prevent injection)
    const sanitizeText = (text: string): string => {
      if (!text || typeof text !== 'string') return '';
      // Remove dangerous characters that could trigger formulas in CSV exports
      let sanitized = text.trim().substring(0, 100);
      const dangerous = ['=', '+', '-', '@', '\t', '\r'];
      while (dangerous.includes(sanitized[0])) {
        sanitized = sanitized.substring(1);
      }
      return sanitized;
    };

    const sanitizedCompanions = (companions || [])
      .filter((c): c is { index: number; name: string } => c && typeof c.name === 'string')
      .map(c => ({ index: c.index, name: sanitizeText(c.name) }))
      .filter(c => c.name.length > 0);

    const sanitizedChildren = (children || [])
      .filter((c): c is { index: number; name: string; age: string } => c && typeof c.name === 'string')
      .map(c => ({ 
        index: c.index, 
        name: sanitizeText(c.name), 
        age: sanitizeText(c.age || '') 
      }))
      .filter(c => c.name.length > 0);

    // Normalize whatsapp
    const normalizedWhatsapp = whatsapp ? whatsapp.replace(/[^0-9+]/g, '') : undefined;

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status: 'confirmed',
      confirmed_adults: validatedAdults,
      confirmed_children: validatedChildren,
      companions: sanitizedCompanions,
      children: sanitizedChildren,
      confirmed_at: new Date().toISOString(),
    };
    if (normalizedWhatsapp !== undefined) {
      updatePayload.whatsapp = normalizedWhatsapp || null;
    }

    // Update the guest record
    const { error: updateError } = await supabase
      .from('guests')
      .update(updatePayload)
      .eq('id', guest_id)
      .eq('event_id', event_id);

    if (updateError) {
      console.error('[confirm-guest] Update failed:', updateError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to update guest confirmation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the updated guest to return QR code
    const { data: updatedGuest } = await supabase
      .from('guests')
      .select('qr_code, name')
      .eq('id', guest_id)
      .single();

    // Generate individual participants with QR codes
    try {
      // Check if event has qr_children enabled
      const { data: qrConfig } = await supabase
        .from('events')
        .select('qr_children')
        .eq('id', event_id)
        .single();

      const qrChildren = qrConfig?.qr_children || false;

      // Delete existing participants for this guest
      await supabase.from('guest_participants').delete().eq('guest_id', guest_id);

      const participants: Array<{
        event_id: string;
        guest_id: string;
        name: string;
        type: string;
      }> = [];

      // Main guest
      participants.push({ event_id, guest_id, name: updatedGuest?.name || 'Titular', type: 'main' });

      // Adult companions
      for (const companion of sanitizedCompanions) {
        participants.push({
          event_id,
          guest_id,
          name: companion.name || `Acompanhante ${companion.index + 1}`,
          type: 'adult',
        });
      }

      // Children (if enabled)
      if (qrChildren) {
        for (const child of sanitizedChildren) {
          participants.push({
            event_id,
            guest_id,
            name: child.name || `Criança ${child.index + 1}`,
            type: 'child',
          });
        }
      }

      if (participants.length > 0) {
        const { error: pError } = await supabase.from('guest_participants').insert(participants);
        if (pError) console.error('[confirm-guest] Participants insert error:', pError.message);
        else console.log(`[confirm-guest] Created ${participants.length} participants for guest ${guest_id}`);
      }
    } catch (pErr: any) {
      console.error('[confirm-guest] Participant generation error:', pErr.message);
    }

    console.log(`[confirm-guest] Successfully confirmed guest ${guest_id}`);

    // Send email notification asynchronously (don't block response)
    try {
      const { data: emailEvent } = await supabase
        .from('events')
        .select('email_notifications, host_email, name, webhook_url')
        .eq('id', event_id)
        .single();

      if (emailEvent?.email_notifications && emailEvent?.host_email) {
        // Find guest name and group
        const { data: guestData } = await supabase
          .from('guests')
          .select('name, group_name')
          .eq('id', guest_id)
          .single();

        const emailUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-confirmation-email`;
        fetch(emailUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            event_id,
            guest_id,
            host_email: emailEvent.host_email,
            event_name: emailEvent.name,
            guest_name: guestData?.name || 'Convidado',
            confirmed_adults: validatedAdults,
            confirmed_children: validatedChildren,
            group_name: guestData?.group_name || null,
            webhook_url: emailEvent.webhook_url || null,
          }),
        }).then(res => {
          console.log(`[confirm-guest] Email notification sent, status: ${res.status}`);
        }).catch(err => {
          console.error(`[confirm-guest] Email notification failed:`, err.message);
        });
      }
    } catch (emailErr: any) {
      console.error(`[confirm-guest] Email check failed:`, emailErr.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        qr_code: updatedGuest?.qr_code,
        confirmed_adults: validatedAdults,
        confirmed_children: validatedChildren
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[confirm-guest] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
