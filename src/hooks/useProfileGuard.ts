import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type ProfileStatus = "approved" | "pending" | "rejected" | null;

export const useProfileGuard = (user: User | null) => {
  const [status, setStatus] = useState<ProfileStatus>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const lastCheckedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    let cancelled = false;

    const checkStatus = async (targetUserId: string) => {
      try {
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", targetUserId)
          .eq("role", "super_admin")
          .maybeSingle();

        if (roleError) throw roleError;

        if (roleData) {
          if (!cancelled) {
            setIsAdmin(true);
            setStatus("approved");
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("status")
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") throw profileError;

        const profileStatus = (profile?.status as ProfileStatus) ?? "pending";
        if (!cancelled) {
          setIsAdmin(false);
          setStatus(profileStatus);
        }
      } catch (err) {
        console.error("Error checking profile guard:", err);
        if (!cancelled) {
          setIsAdmin(false);
          setStatus("pending");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (!userId) {
      lastCheckedUserIdRef.current = null;
      setStatus(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    if (lastCheckedUserIdRef.current === userId) {
      return;
    }

    lastCheckedUserIdRef.current = userId;
    setLoading(true);
    checkStatus(userId);

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { status, loading, isAdmin };
};
