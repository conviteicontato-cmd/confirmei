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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("No authorization header found");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract the token from the Bearer header
    const token = authHeader.replace("Bearer ", "");
    
    // Create a client with the user's token for validation
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    // Use getClaims() for JWT validation - works with ES256 tokens in Lovable Cloud
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      console.log("Auth error:", claimsError?.message || "No claims found");
      return new Response(JSON.stringify({ error: "Invalid token", details: claimsError?.message || "Token validation failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorUserId = claimsData.claims.sub as string;
    const actorEmail = claimsData.claims.email as string;
    
    console.log(`Authenticated user: ${actorEmail} (${actorUserId})`);

    // Check if user is super admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", actorUserId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Not a super admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`Admin action: ${action} by user ${actorEmail}`);

    let result;

    switch (action) {
      case "approve_user": {
        const { userId } = params;
        
        // Prevent modifying super admin
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("email")
          .eq("user_id", userId)
          .single();
        
        if (targetProfile?.email === SUPER_ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: "Cannot modify super admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient
          .from("profiles")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: actorUserId,
            rejection_reason: null,
          })
          .eq("user_id", userId);

        if (error) throw error;

        // Auto-confirm email when admin approves user
        try {
          const { error: confirmError } = await adminClient.auth.admin.updateUserById(userId, {
            email_confirm: true,
          });
          if (confirmError) {
            console.error("Error confirming user email:", confirmError);
          } else {
            console.log(`Email auto-confirmed for user ${userId}`);
          }
        } catch (emailErr) {
          console.error("Failed to confirm email:", emailErr);
        }

        // Log audit event
        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "approve_user",
          entity_type: "profile",
          entity_id: userId,
          details: { target_email: targetProfile?.email },
        });

        result = { success: true, message: "User approved" };
        break;
      }

      case "reject_user": {
        const { userId, reason } = params;
        
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("email")
          .eq("user_id", userId)
          .single();
        
        if (targetProfile?.email === SUPER_ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: "Cannot modify super admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient
          .from("profiles")
          .update({
            status: "rejected",
            rejection_reason: reason || null,
          })
          .eq("user_id", userId);

        if (error) throw error;

        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "reject_user",
          entity_type: "profile",
          entity_id: userId,
          details: { target_email: targetProfile?.email, reason },
        });

        result = { success: true, message: "User rejected" };
        break;
      }

      case "deactivate_user": {
        const { userId } = params;
        
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("email")
          .eq("user_id", userId)
          .single();
        
        if (targetProfile?.email === SUPER_ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: "Cannot deactivate super admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient
          .from("profiles")
          .update({ status: "rejected" })
          .eq("user_id", userId);

        if (error) throw error;

        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "deactivate_user",
          entity_type: "profile",
          entity_id: userId,
          details: { target_email: targetProfile?.email },
        });

        result = { success: true, message: "User deactivated" };
        break;
      }

      case "reactivate_user": {
        const { userId } = params;
        
        const { error } = await adminClient
          .from("profiles")
          .update({ 
            status: "approved",
            rejection_reason: null,
          })
          .eq("user_id", userId);

        if (error) throw error;

        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "reactivate_user",
          entity_type: "profile",
          entity_id: userId,
        });

        result = { success: true, message: "User reactivated" };
        break;
      }

      case "update_settings": {
        const { settings } = params;
        
        for (const [key, value] of Object.entries(settings)) {
          await adminClient
            .from("system_settings")
            .upsert(
              { 
                key,
                value: JSON.stringify(value), 
                updated_at: new Date().toISOString(),
                updated_by: actorUserId,
              },
              { onConflict: "key" }
            );
        }

        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "update_settings",
          entity_type: "system_settings",
          details: settings,
        });

        result = { success: true, message: "Settings updated" };
        break;
      }

      case "update_event_status": {
        const { eventId, active } = params;
        
        // For now, we'll use a soft approach - just log the action
        // In future, you can add an 'active' column to events table
        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: active ? "activate_event" : "deactivate_event",
          entity_type: "event",
          entity_id: eventId,
        });

        result = { success: true, message: `Event ${active ? "activated" : "deactivated"}` };
        break;
      }

      case "get_dashboard_stats": {
        // Get user stats
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("status, created_at");

        const userStats = {
          total: profiles?.length || 0,
          pending: profiles?.filter((p) => p.status === "pending").length || 0,
          approved: profiles?.filter((p) => p.status === "approved").length || 0,
          rejected: profiles?.filter((p) => p.status === "rejected").length || 0,
        };

        // Get event stats
        const { data: events } = await adminClient
          .from("events")
          .select("id, event_date, created_at");

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const eventStats = {
          total: events?.length || 0,
          upcoming: events?.filter((e) => new Date(e.event_date) >= today).length || 0,
          past: events?.filter((e) => new Date(e.event_date) < today).length || 0,
          last24h: events?.filter((e) => new Date(e.created_at) >= last24h).length || 0,
          last7d: events?.filter((e) => new Date(e.created_at) >= last7d).length || 0,
          last30d: events?.filter((e) => new Date(e.created_at) >= last30d).length || 0,
        };

        // Get checkin stats for today
        const { data: guests } = await adminClient
          .from("guests")
          .select("checkin_done, checkin_at");

        const checkinsToday = guests?.filter(
          (g) => g.checkin_done && g.checkin_at && new Date(g.checkin_at) >= today
        ).length || 0;

        result = {
          users: userStats,
          events: eventStats,
          checkinsToday,
        };
        break;
      }

      case "sync_users": {
        // Sincronização executada apenas sob demanda (manual)
        const { data: authListData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        const authUsers = authListData?.users || [];

        const { data: existingProfiles } = await adminClient
          .from("profiles")
          .select("user_id");

        const existingUserIds = new Set(existingProfiles?.map((p) => p.user_id) || []);
        const missingUsers = authUsers.filter((u) => !existingUserIds.has(u.id));

        if (missingUsers.length > 0) {
          const newProfiles = missingUsers.map((u) => ({
            user_id: u.id,
            email: u.email || "",
            full_name: u.user_metadata?.full_name || u.email || "Sem nome",
            status: "pending",
            events_contracted: 0,
            events_used: 0,
          }));

          const { error: insertError } = await adminClient
            .from("profiles")
            .insert(newProfiles);

          if (insertError) {
            console.error("Error backfilling profiles:", insertError);
          } else {
            console.log(`Backfilled ${missingUsers.length} missing profiles`);
          }
        }

        result = { success: true, synced: missingUsers.length };
        break;
      }

      case "get_all_users": {
        // Apenas leitura para evitar loops de escrita/refetch automático
        const { data: profiles, error } = await adminClient
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Get roles for each user
        const { data: roles } = await adminClient
          .from("user_roles")
          .select("user_id, role");

        // Get event counts for each user
        const userIds = profiles?.map((p) => p.user_id) || [];
        const { data: events } = await adminClient
          .from("events")
          .select("user_id")
          .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

        const eventCounts = userIds.reduce((acc, id) => {
          acc[id] = events?.filter((e) => e.user_id === id).length || 0;
          return acc;
        }, {} as Record<string, number>);

        const usersWithRoles = profiles?.map((p) => {
          const userRoles = roles?.filter((r) => r.user_id === p.user_id).map((r) => r.role) || [];
          const isSuperAdmin = userRoles.includes("super_admin");
          const eventsContracted = p.events_contracted || 0;
          const eventsUsed = p.events_used || 0;
          const availableEvents = isSuperAdmin ? -1 : Math.max(0, eventsContracted - eventsUsed);

          return {
            ...p,
            roles: userRoles,
            event_count: eventCounts[p.user_id] || 0,
            events_contracted: eventsContracted,
            events_used: eventsUsed,
            available_events: availableEvents,
            is_super_admin: isSuperAdmin,
          };
        });

        result = { users: usersWithRoles };
        break;
      }

      case "get_all_events": {
        const { data: events, error } = await adminClient
          .from("events")
          .select(`
            *,
            profiles!events_user_id_fkey (full_name, email)
          `)
          .order("created_at", { ascending: false });

        if (error) {
          // If foreign key doesn't exist, fetch separately
          const { data: eventsSimple } = await adminClient
            .from("events")
            .select("*")
            .order("created_at", { ascending: false });

          const userIds = [...new Set(eventsSimple?.map((e) => e.user_id) || [])];
          const { data: profiles } = await adminClient
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", userIds);

          const eventsWithOwners = eventsSimple?.map((e) => ({
            ...e,
            owner: profiles?.find((p) => p.user_id === e.user_id),
          }));

          result = { events: eventsWithOwners };
        } else {
          result = { events };
        }
        break;
      }

      case "get_audit_logs": {
        const { limit = 100, offset = 0, filters } = params;

        let query = adminClient
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (filters?.action) {
          query = query.eq("action", filters.action);
        }
        if (filters?.entity_type) {
          query = query.eq("entity_type", filters.entity_type);
        }
        if (filters?.user_id) {
          query = query.eq("user_id", filters.user_id);
        }
        if (filters?.entity_id) {
          query = query.eq("entity_id", filters.entity_id);
        }

        const { data: logs, error } = await query;

        if (error) throw error;

        // Get user names for logs
        const userIds = [...new Set(logs?.map((l) => l.user_id).filter(Boolean) || [])];
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        const logsWithUsers = logs?.map((l) => ({
          ...l,
          user: profiles?.find((p) => p.user_id === l.user_id),
        }));

        result = { logs: logsWithUsers };
        break;
      }

      case "get_settings": {
        const { data: settings, error } = await adminClient
          .from("system_settings")
          .select("*");

        if (error) throw error;

        const settingsMap = settings?.reduce((acc, s) => {
          acc[s.key] = typeof s.value === "string" ? JSON.parse(s.value) : s.value;
          return acc;
        }, {} as Record<string, any>);

        result = { settings: settingsMap };
        break;
      }

      case "setup_initial_admin": {
        // This action can only be called once to set up the initial admin
        const { data: existingAdmins } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("role", "super_admin");

        // If there's already an admin and the caller is not them, deny
        if (existingAdmins && existingAdmins.length > 0) {
          return new Response(JSON.stringify({ error: "Admin already configured" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get user by email
        const { data: profile } = await adminClient
          .from("profiles")
          .select("user_id")
          .eq("email", SUPER_ADMIN_EMAIL)
          .single();

        if (!profile) {
          return new Response(
            JSON.stringify({ error: "Super admin user not found. Please register first." }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Add super_admin role
        await adminClient.from("user_roles").insert({
          user_id: profile.user_id,
          role: "super_admin",
        });

        // Auto-approve the admin
        await adminClient
          .from("profiles")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
          })
          .eq("user_id", profile.user_id);

        await adminClient.from("audit_logs").insert({
          user_id: profile.user_id,
          action: "initial_admin_setup",
          entity_type: "system",
          details: { admin_email: SUPER_ADMIN_EMAIL },
        });

        result = { success: true, message: "Initial admin configured" };
        break;
      }

      case "update_user_limit": {
        const { userId, newLimit, reason } = params;

        // Get current limit
        const { data: currentProfile } = await adminClient
          .from("profiles")
          .select("event_limit, email")
          .eq("user_id", userId)
          .single();

        if (currentProfile?.email === SUPER_ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: "Cannot modify super admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update profile with new limit
        const { error: updateError } = await adminClient
          .from("profiles")
          .update({ event_limit: newLimit })
          .eq("user_id", userId);

        if (updateError) throw updateError;

        // Log limit change history
        await adminClient.from("user_limit_history").insert({
          user_id: userId,
          previous_limit: currentProfile?.event_limit,
          new_limit: newLimit,
          changed_by: actorUserId,
          reason,
          change_type: "limit_change",
        });

        // Log audit event
        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "update_user_limit",
          entity_type: "profile",
          entity_id: userId,
          details: {
            previous_limit: currentProfile?.event_limit,
            new_limit: newLimit,
            reason,
          },
        });

        result = { success: true, message: "User limit updated" };
        break;
      }

      case "update_user_credits": {
        const { userId, eventsContracted, reason } = params;

        // Check if user is super admin - they shouldn't have credits managed
        const { data: targetRoles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "super_admin")
          .maybeSingle();

        if (targetRoles) {
          return new Response(JSON.stringify({ error: "Super admins have unlimited events" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get current values
        const { data: currentProfile } = await adminClient
          .from("profiles")
          .select("events_contracted, events_used, email")
          .eq("user_id", userId)
          .single();

        if (currentProfile?.email === SUPER_ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: "Cannot modify super admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const oldContracted = currentProfile?.events_contracted || 0;

        // Update profile with new credits
        const { error: updateError } = await adminClient
          .from("profiles")
          .update({ events_contracted: eventsContracted })
          .eq("user_id", userId);

        if (updateError) throw updateError;

        // Log credit change history
        await adminClient.from("user_limit_history").insert({
          user_id: userId,
          previous_limit: oldContracted,
          new_limit: eventsContracted,
          changed_by: actorUserId,
          reason,
          change_type: "credit_adjustment",
          old_value: oldContracted,
          new_value: eventsContracted,
        });

        // Log audit event
        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "update_user_credits",
          entity_type: "profile",
          entity_id: userId,
          details: {
            old_contracted: oldContracted,
            new_contracted: eventsContracted,
            events_used: currentProfile?.events_used || 0,
            reason,
          },
        });

        result = { success: true, message: "User credits updated" };
        break;
      }

      case "reset_user_credits": {
        const { userId, newContracted, reason } = params;

        // Check if user is super admin
        const { data: targetRoles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "super_admin")
          .maybeSingle();

        if (targetRoles) {
          return new Response(JSON.stringify({ error: "Super admins have unlimited events" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get current values
        const { data: currentProfile } = await adminClient
          .from("profiles")
          .select("events_contracted, events_used, email")
          .eq("user_id", userId)
          .single();

        if (currentProfile?.email === SUPER_ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: "Cannot modify super admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Reset credits: set new contracted and reset used to 0
        const { error: updateError } = await adminClient
          .from("profiles")
          .update({ 
            events_contracted: newContracted,
            events_used: 0,
          })
          .eq("user_id", userId);

        if (updateError) throw updateError;

        // Log credit reset history
        await adminClient.from("user_limit_history").insert({
          user_id: userId,
          previous_limit: currentProfile?.events_contracted,
          new_limit: newContracted,
          changed_by: actorUserId,
          reason: reason || "Credit reset - new cycle",
          change_type: "credit_reset",
          old_value: currentProfile?.events_used || 0,
          new_value: 0,
        });

        // Log audit event
        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "reset_user_credits",
          entity_type: "profile",
          entity_id: userId,
          details: {
            old_contracted: currentProfile?.events_contracted,
            new_contracted: newContracted,
            old_used: currentProfile?.events_used,
            new_used: 0,
            reason,
          },
        });

        result = { success: true, message: "User credits reset" };
        break;
      }

      case "get_user_events": {
        const { userId } = params;

        const { data: events } = await adminClient
          .from("events")
          .select("id, name, event_date, created_at")
          .eq("user_id", userId)
          .order("event_date", { ascending: false });

        // Get guest counts for each event
        const eventIds = events?.map((e) => e.id) || [];
        const { data: guests } = await adminClient
          .from("guests")
          .select("event_id, checkin_done")
          .in("event_id", eventIds);

        const eventsWithCounts = events?.map((e) => ({
          ...e,
          guest_count: guests?.filter((g) => g.event_id === e.id).length || 0,
          checkin_count: guests?.filter((g) => g.event_id === e.id && g.checkin_done).length || 0,
        }));

        result = { events: eventsWithCounts };
        break;
      }

      case "get_user_limit_history": {
        const { userId } = params;

        const { data: history } = await adminClient
          .from("user_limit_history")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        // Get admin names
        const adminIds = [...new Set(history?.map((h) => h.changed_by) || [])];
        const { data: admins } = await adminClient
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", adminIds);

        const historyWithNames = history?.map((h) => ({
          ...h,
          changed_by_name: admins?.find((a) => a.user_id === h.changed_by)?.full_name,
        }));

        result = { history: historyWithNames };
        break;
      }

      case "create_user": {
        const { email, password, fullName, autoApprove } = params;

        if (!email || !password || !fullName) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create user via admin API (auto-confirms email)
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update profile status if auto-approve
        if (autoApprove && newUser.user) {
          await adminClient
            .from("profiles")
            .update({
              status: "approved",
              approved_at: new Date().toISOString(),
              approved_by: actorUserId,
            })
            .eq("user_id", newUser.user.id);
        }

        // Log audit event
        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "create_user",
          entity_type: "profile",
          entity_id: newUser.user?.id,
          details: { email, full_name: fullName, auto_approve: autoApprove },
        });

        result = { success: true, message: "User created" };
        break;
      }

      case "delete_event": {
        const { eventId } = params;

        // Get event info for audit log
        const { data: eventData } = await adminClient
          .from("events")
          .select("name, user_id")
          .eq("id", eventId)
          .single();

        // Delete guests first
        await adminClient.from("guests").delete().eq("event_id", eventId);

        // Delete event
        const { error: deleteError } = await adminClient
          .from("events")
          .delete()
          .eq("id", eventId);

        if (deleteError) throw deleteError;

        // Log audit event
        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "admin_delete_event",
          entity_type: "event",
          entity_id: eventId,
          details: { event_name: eventData?.name, owner_id: eventData?.user_id },
        });

        result = { success: true, message: "Event deleted" };
        break;
      }

      case "adjust_user_credits": {
        const { userId, creditsStandard, creditsQr, reason, resetEvents } = params;

        // Block managing credits for super admins
        const { data: targetRoles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "super_admin")
          .maybeSingle();

        if (targetRoles) {
          return new Response(JSON.stringify({ error: "Super admins have unlimited events" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Get current values
        const { data: currentProfile } = await adminClient
          .from("profiles")
          .select("credits_standard, credits_qr, email")
          .eq("user_id", userId)
          .single();

        if (currentProfile?.email === SUPER_ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: "Cannot modify super admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const oldStandard = currentProfile?.credits_standard ?? 0;
        const oldQr = currentProfile?.credits_qr ?? 0;
        const newStandard = Number.isFinite(creditsStandard) ? Math.max(0, Math.trunc(creditsStandard)) : oldStandard;
        const newQr = Number.isFinite(creditsQr) ? Math.max(0, Math.trunc(creditsQr)) : oldQr;

        const updatePayload: Record<string, number> = {
          credits_standard: newStandard,
          credits_qr: newQr,
        };
        if (resetEvents) {
          updatePayload.events_used = 0;
        }

        const { error: updateError } = await adminClient
          .from("profiles")
          .update(updatePayload)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        // Log audit event with previous and new values
        await adminClient.from("audit_logs").insert({
          user_id: actorUserId,
          action: "adjust_user_credits",
          entity_type: "profile",
          entity_id: userId,
          details: {
            previous: { credits_standard: oldStandard, credits_qr: oldQr },
            new: { credits_standard: newStandard, credits_qr: newQr },
            reset_events: !!resetEvents,
            reason,
          },
        });

        result = {
          success: true,
          message: "User credits adjusted",
          credits_standard: newStandard,
          credits_qr: newQr,
        };
        break;
      }

      case "get_user_credit_details": {
        const { userId } = params;

        // Profile credit balances
        const { data: profile, error: profileError } = await adminClient
          .from("profiles")
          .select("credits_standard, credits_qr, events_used, events_contracted")
          .eq("user_id", userId)
          .single();

        if (profileError) throw profileError;

        // Events created by the user, with credit_type
        const { data: events, error: eventsError } = await adminClient
          .from("events")
          .select("id, name, event_date, created_at, credit_type")
          .eq("user_id", userId)
          .order("event_date", { ascending: false });

        if (eventsError) throw eventsError;

        const allEvents = events || [];
        const standardCount = allEvents.filter((e) => e.credit_type === "standard").length;
        const qrCount = allEvents.filter((e) => e.credit_type === "qr").length;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const upcomingEvents = allEvents.filter((e) => new Date(e.event_date) >= today);
        const pastEvents = allEvents.filter((e) => new Date(e.event_date) < today);

        result = {
          credits_standard: profile?.credits_standard ?? 0,
          credits_qr: profile?.credits_qr ?? 0,
          events_used: profile?.events_used ?? 0,
          events_contracted: profile?.events_contracted ?? 0,
          events_standard_count: standardCount,
          events_qr_count: qrCount,
          upcoming_events: upcomingEvents,
          past_events: pastEvents,
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Admin operation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
