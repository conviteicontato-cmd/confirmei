import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export function useAdminRole(user: User | null) {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastCheckedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    let cancelled = false;

    async function checkRole(targetUserId: string) {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", targetUserId)
          .eq("role", "super_admin")
          .maybeSingle();

        if (error) throw error;
        if (!cancelled) {
          setIsSuperAdmin(!!data);
        }
      } catch (err) {
        console.error("Error checking admin role:", err);
        if (!cancelled) {
          setIsSuperAdmin(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (!userId) {
      lastCheckedUserIdRef.current = null;
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    // Evita refetch/loop quando apenas o objeto user muda mas o id é o mesmo
    if (lastCheckedUserIdRef.current === userId) {
      return;
    }

    lastCheckedUserIdRef.current = userId;
    setLoading(true);
    checkRole(userId);

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isSuperAdmin, loading };
}
