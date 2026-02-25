import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import EventSidebar from "@/components/event/EventSidebar";
import EventManagement from "@/components/event/EventManagement";
import CheckinPage from "@/components/event/CheckinPage";
import EventSettings from "@/components/event/EventSettings";

const EventDetails = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"convidados" | "checkin" | "configuracoes">("convidados");
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
        return;
      }
      
      // Fetch event name for sidebar
      if (eventId) {
        supabase
          .from("events")
          .select("name")
          .eq("id", eventId)
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setEventName(data.name);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, eventId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || !eventId) {
    return null;
  }

  const handleBackFromSettings = () => {
    setActiveTab("convidados");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "convidados":
        return <EventManagement eventId={eventId} userId={session.user.id} />;
      case "checkin":
        return <CheckinPage eventId={eventId} eventName={eventName} />;
      case "configuracoes":
        return <EventSettings eventId={eventId} userId={session.user.id} onBack={handleBackFromSettings} />;
      default:
        return <EventManagement eventId={eventId} userId={session.user.id} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <EventSidebar 
        user={session.user} 
        eventName={eventName}
        eventId={eventId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="flex-1 overflow-auto pt-16 lg:pt-0">
        {renderContent()}
      </main>
    </div>
  );
};

export default EventDetails;
