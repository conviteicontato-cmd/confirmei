import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { event_id, password } = await req.json();

    if (!event_id || !password) {
      return new Response(
        JSON.stringify({ error: 'event_id e password são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: event, error } = await supabase
      .from('events')
      .select('id, name, host_password, cover_image_url, primary_color, secondary_color, allow_host_edit')
      .eq('id', event_id)
      .single();

    if (error || !event) {
      return new Response(
        JSON.stringify({ error: 'Evento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!event.host_password) {
      return new Response(
        JSON.stringify({ error: 'Senha do anfitrião não configurada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password !== event.host_password) {
      return new Response(
        JSON.stringify({ error: 'Senha incorreta' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    const tokenPayload = btoa(JSON.stringify({
      event_id: event.id,
      event_name: event.name,
      type: 'host_view',
      exp: expiresAt,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event.id,
        event_name: event.name,
        token: tokenPayload,
        expires_at: expiresAt,
        allow_host_edit: event.allow_host_edit ?? false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[verify-host-password] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
