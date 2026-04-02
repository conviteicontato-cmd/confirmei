import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import EventDetails from "./pages/EventDetails";
import PublicEvent from "./pages/PublicEvent";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import PublicCheckin from "./pages/PublicCheckin";
import HostView from "./pages/HostView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<RouteErrorBoundary><Dashboard /></RouteErrorBoundary>} />
          <Route path="/event/:eventId" element={<RouteErrorBoundary><EventDetails /></RouteErrorBoundary>} />
          <Route path="/confirmar/:eventId" element={<RouteErrorBoundary><PublicEvent /></RouteErrorBoundary>} />
          <Route path="/admin" element={<RouteErrorBoundary><Admin /></RouteErrorBoundary>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/checkin/:code" element={<PublicCheckin />} />
          <Route path="/evento/:eventId/anfitriao" element={<HostView />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
