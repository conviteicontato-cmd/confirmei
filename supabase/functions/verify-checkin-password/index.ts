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
    const { checkin_code, password } = await req.json();

    if (!checkin_code || !password) {
      return new Response(
        JSON.stringify({ error: 'checkin_code e password são obrigatórios' }),
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
      .select('id, name, checkin_password')
      .eq('checkin_code', checkin_code)
      .single();

    if (error || !event) {
      return new Response(
        JSON.stringify({ error: 'Código de check-in inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!event.checkin_password) {
      return new Response(
        JSON.stringify({ error: 'Defina uma senha de check-in nas configurações do evento' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password !== event.checkin_password) {
      return new Response(
        JSON.stringify({ error: 'Senha incorreta' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a simple session token (event_id + timestamp encoded)
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
    const tokenPayload = btoa(JSON.stringify({
      event_id: event.id,
      event_name: event.name,
      checkin_code,
      exp: expiresAt,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event.id,
        event_name: event.name,
        token: tokenPayload,
        expires_at: expiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[verify-checkin-password] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro inesperado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
