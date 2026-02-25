import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Users, QrCode, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="container mx-auto px-4 py-12 lg:py-20 relative">
          <div className="max-w-3xl mx-auto text-center animate-slide-up">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-4 lg:mb-6">
              Convitei
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-6 lg:mb-8 max-w-xl mx-auto px-4">
              A plataforma completa para gerenciar seus eventos, confirmações de presença e check-in com QR Code.
            </p>
            <Button
              onClick={() => navigate("/auth")}
              className="btn-gold rounded-full px-6 lg:px-8 py-5 lg:py-6 text-base lg:text-lg"
            >
              Começar agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-12 lg:py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
          <FeatureCard
            icon={Calendar}
            title="Crie Eventos"
            description="Configure seus eventos com foto de capa, cores personalizadas e mensagens especiais."
          />
          <FeatureCard
            icon={Users}
            title="Gerencie Convidados"
            description="Adicione convidados, defina limites de acompanhantes e acompanhe confirmações em tempo real."
          />
          <FeatureCard
            icon={QrCode}
            title="Check-in por QR Code"
            description="Cada convidado recebe um QR Code único para check-in rápido e seguro no dia do evento."
          />
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 pb-12 lg:pb-20">
        <div className="card-elegant p-8 lg:p-12 text-center bg-gradient-to-br from-primary/5 to-primary/10">
          <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-4">
            Pronto para começar?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Crie sua conta gratuita e comece a organizar seus eventos hoje mesmo.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            className="btn-gold rounded-full px-8"
          >
            Criar conta grátis
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2027 Convitei. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) => (
  <div className="card-elegant p-5 lg:p-6 text-center hover:shadow-lg transition-all duration-300">
    <div className="inline-flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-primary/10 text-primary mb-3 lg:mb-4">
      <Icon className="h-6 w-6 lg:h-7 lg:w-7" />
    </div>
    <h3 className="text-base lg:text-lg font-display font-semibold text-foreground mb-2">
      {title}
    </h3>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);

export default Index;
