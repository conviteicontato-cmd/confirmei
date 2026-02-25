const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface WebhookRequest {
  webhook_url: string;
  payload: Record<string, unknown>;
}

// Validate webhook URL to prevent SSRF attacks
const validateWebhookUrl = (url: string): { valid: boolean; error?: string } => {
  try {
    const parsed = new URL(url);

    // Block localhost and loopback addresses
    const blockedHostnames = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'];
    if (blockedHostnames.some(h => parsed.hostname.toLowerCase() === h)) {
      return { valid: false, error: 'Localhost URLs are not allowed' };
    }

    // Block private IP ranges
    const blockedPatterns = [
      /^127\.\d+\.\d+\.\d+$/,           // 127.0.0.0/8
      /^10\.\d+\.\d+\.\d+$/,            // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,  // 172.16.0.0/12
      /^192\.168\.\d+\.\d+$/,           // 192.168.0.0/16
      /^169\.254\.\d+\.\d+$/,           // Link-local (AWS metadata)
      /^0\.\d+\.\d+\.\d+$/,             // 0.0.0.0/8
      /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\.\d+\.\d+$/,  // 100.64.0.0/10 (CGNAT)
    ];

    if (blockedPatterns.some(p => p.test(parsed.hostname))) {
      return { valid: false, error: 'Private IP addresses are not allowed' };
    }

    // Require HTTPS for security
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Block common cloud metadata endpoints
    const blockedHosts = [
      'metadata.google.internal',
      'metadata.google.com',
      'metadata.azure.com',
    ];
    if (blockedHosts.some(h => parsed.hostname.toLowerCase().includes(h))) {
      return { valid: false, error: 'Cloud metadata endpoints are not allowed' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: WebhookRequest = await req.json();
    const { webhook_url, payload } = body;

    console.log(`[send-webhook] Processing webhook request to ${webhook_url}`);

    // Validate required fields
    if (!webhook_url || !payload) {
      return new Response(
        JSON.stringify({ error: 'webhook_url and payload are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate the URL for security
    const validation = validateWebhookUrl(webhook_url);
    if (!validation.valid) {
      console.error(`[send-webhook] URL validation failed: ${validation.error}`);
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send the webhook with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      console.log(`[send-webhook] Webhook sent, status: ${response.status}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: response.status,
          statusText: response.statusText 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Webhook request failed';
      console.error(`[send-webhook] Fetch error: ${errorMessage}`);

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('[send-webhook] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
