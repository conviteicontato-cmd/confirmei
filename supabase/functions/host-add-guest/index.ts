import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface HostAddGuestRequest {
  token: string;
  event_id: string;
  name: string;
  max_adults?: number;
  max_children?: number;
  status?: 'pending' | 'confirmed';
  confirmed_adults?: number;
  confirmed_children?: number;
  observations?: string | null;
  group_name?: string | null;
  whatsapp?: string | null;
}

interface HostToken {
  event_id: string;
  event_name: string;
  type: string;
  exp: number;
}

const decodeHostToken = (token: string): HostToken | null => {
  try {
    const payload = JSON.parse(atob(token)) as HostToken;
    if (payload.type !== 'host_view') return null;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const normalizeWhatsApp = (value?: string | null): string | null => {
  if (!value) return null;
  const digits = value.replace(/[^0-9+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits;
  if (digits.length >= 10) return '+' + digits;
  return digits;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: HostAddGuestRequest = await req.json();
    const { token, event_id } = body;

    if (!token || !event_id) {
      return new Response(
        JSON.stringify({ error: 'token e event_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate host token
    const payload = decodeHostToken(token);
    if (!payload || payload.event_id !== event_id) {
      console.error('[host-add-guest] Invalid or expired host token');
      return new Response(
        JSON.stringify({ error: 'Sessão de anfitrião inválida ou expirada. Faça login novamente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmedName = (body.name || '').trim();
    if (!trimmedName) {
      return new Response(
        JSON.stringify({ error: 'Nome do convidado é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Confirm event exists and host editing is allowed
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, allow_host_edit')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      console.error('[host-add-guest] Event not found:', eventError?.message);
      return new Response(
        JSON.stringify({ error: 'Evento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!event.allow_host_edit) {
      return new Response(
        JSON.stringify({ error: 'Edição pelo anfitrião não está habilitada para este evento' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Duplicate name check
    const { data: existingGuest } = await supabase
      .from('guests')
      .select('id')
      .eq('event_id', event_id)
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existingGuest) {
      return new Response(
        JSON.stringify({ error: 'Já existe um convidado com este nome neste evento' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const maxA = Math.max(0, Number(body.max_adults) || 0);
    const maxC = Math.max(0, Number(body.max_children) || 0);
    const status = body.status === 'confirmed' ? 'confirmed' : 'pending';
    const confA = status === 'confirmed' ? Math.min(Math.max(0, Number(body.confirmed_adults) || 0), maxA) : 0;
    const confC = status === 'confirmed' ? Math.min(Math.max(0, Number(body.confirmed_children) || 0), maxC) : 0;

    const { error: insertError } = await supabase.from('guests').insert({
      event_id,
      name: trimmedName,
      max_adults: maxA,
      max_children: maxC,
      status,
      confirmed_adults: confA,
      confirmed_children: confC,
      observations: (body.observations || '').trim() || null,
      group_name: (body.group_name || '').trim() || null,
      whatsapp: normalizeWhatsApp(body.whatsapp),
    });

    if (insertError) {
      console.error('[host-add-guest] Insert failed:', insertError.message);
      return new Response(
        JSON.stringify({ error: 'Não foi possível adicionar o convidado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[host-add-guest] Guest "${trimmedName}" added to event ${event_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[host-add-guest] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
