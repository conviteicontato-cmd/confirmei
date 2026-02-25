import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPER_ADMIN_EMAIL = "nanacomunicaa@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if admin already exists
    const { data: existingAdmins } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("role", "super_admin");

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Super admin already configured",
          already_configured: true 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user by email
    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_id, email")
      .eq("email", SUPER_ADMIN_EMAIL)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `User with email ${SUPER_ADMIN_EMAIL} not found. Please register this account first.`,
          user_not_found: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Add super_admin role
    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: profile.user_id,
      role: "super_admin",
    });

    if (roleError) {
      throw roleError;
    }

    // Auto-approve the admin
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("user_id", profile.user_id);

    if (profileError) {
      throw profileError;
    }

    // Log the setup
    await adminClient.from("audit_logs").insert({
      user_id: profile.user_id,
      action: "initial_admin_setup",
      entity_type: "system",
      details: { admin_email: SUPER_ADMIN_EMAIL },
    });

    console.log(`Super admin configured: ${SUPER_ADMIN_EMAIL}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Super admin configured: ${SUPER_ADMIN_EMAIL}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Setup admin error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
