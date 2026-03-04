import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface EmailRequest {
  event_id: string;
  guest_id: string;
  host_email: string;
  event_name: string;
  guest_name: string;
  confirmed_adults: number;
  confirmed_children: number;
  group_name: string | null;
  webhook_url: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: EmailRequest = await req.json();
    const {
      event_id, guest_id, host_email, event_name,
      guest_name, confirmed_adults, confirmed_children,
      group_name, webhook_url,
    } = body;

    console.log(`[send-confirmation-email] Processing for guest ${guest_id} in event ${event_id}`);

    if (!host_email || !event_name || !guest_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Build notification payload
    const payload = {
      type: "guest_confirmation",
      event_id,
      guest_id,
      event_name,
      guest_name,
      confirmed_adults,
      confirmed_children,
      group_name: group_name || "Sem grupo",
      host_email,
      timestamp,
      subject: `Nova confirmação – ${event_name}`,
      body: `${guest_name} confirmou presença!\n\nAdultos: ${confirmed_adults}\nCrianças: ${confirmed_children}\nGrupo: ${group_name || "Sem grupo"}\nData/hora: ${timestamp}`,
    };

    // Send via webhook if configured (Make/Zapier/n8n integration)
    if (webhook_url) {
      let lastError: string | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[send-confirmation-email] Webhook attempt ${attempt}/3`);
          const res = await fetch(webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            console.log(`[send-confirmation-email] Webhook sent successfully on attempt ${attempt}`);
            return new Response(
              JSON.stringify({ success: true, method: 'webhook', attempt }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          lastError = `HTTP ${res.status}: ${await res.text()}`;
          console.warn(`[send-confirmation-email] Webhook attempt ${attempt} failed: ${lastError}`);
        } catch (err: any) {
          lastError = err.message;
          console.warn(`[send-confirmation-email] Webhook attempt ${attempt} error: ${lastError}`);
        }
        // Backoff: 1s, 2s, 4s
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }

      console.error(`[send-confirmation-email] All 3 webhook attempts failed: ${lastError}`);
      return new Response(
        JSON.stringify({ success: false, method: 'webhook', error: lastError }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No webhook configured — log and return
    console.log(`[send-confirmation-email] No webhook configured, notification not sent`);
    return new Response(
      JSON.stringify({ success: false, method: 'none', error: 'No webhook configured' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-confirmation-email] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
