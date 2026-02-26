import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

type ProfileStatus = "approved" | "pending" | "rejected" | null;

export const useProfileGuard = (user: User | null) => {
  const [status, setStatus] = useState<ProfileStatus>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkStatus = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", user.id)
        .single();

      const profileStatus = (profile?.status as ProfileStatus) ?? "pending";
      setStatus(profileStatus);

      if (profileStatus !== "approved") {
        await supabase.auth.signOut();
        navigate("/auth");
      }

      setLoading(false);
    };

    checkStatus();
  }, [user, navigate]);

  return { status, loading };
};
