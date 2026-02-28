import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type ProfileStatus = "approved" | "pending" | "rejected" | null;

export const useProfileGuard = (user: User | null) => {
  const [status, setStatus] = useState<ProfileStatus>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const checkStatus = async () => {
      // Check admin role first - admins always bypass approval
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (roleData) {
        setIsAdmin(true);
        setStatus("approved");
        setLoading(false);
        return;
      }

      // For non-admins, check profile status
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user.id)
        .single();

      const profileStatus = (profile?.status as ProfileStatus) ?? "pending";
      setStatus(profileStatus);
      setLoading(false);
    };

    checkStatus();
  }, [user]);

  return { status, loading, isAdmin };
};
