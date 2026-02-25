import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SystemSettings {
  registration_enabled: boolean;
  require_approval: boolean;
  max_events_per_user: number;
  max_guests_per_event: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  registration_enabled: true,
  require_approval: true,
  max_events_per_user: 50,
  max_guests_per_event: 500,
};

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("key, value");

        if (error) {
          console.error("Error fetching settings:", error);
          return;
        }

        if (data) {
          const settingsMap = data.reduce((acc, item) => {
            try {
              acc[item.key as keyof SystemSettings] = 
                typeof item.value === "string" ? JSON.parse(item.value) : item.value;
            } catch {
              acc[item.key as keyof SystemSettings] = item.value;
            }
            return acc;
          }, {} as Record<string, unknown>);

          setSettings({
            registration_enabled: settingsMap.registration_enabled === true || settingsMap.registration_enabled === "true",
            require_approval: settingsMap.require_approval === true || settingsMap.require_approval === "true",
            max_events_per_user: Number(settingsMap.max_events_per_user) || 50,
            max_guests_per_event: Number(settingsMap.max_guests_per_event) || 500,
          });
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return { settings, loading };
}
