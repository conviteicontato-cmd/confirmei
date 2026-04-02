import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Users, QrCode, ArrowRight } from "lucide-react";
import logo from "@/assets/Logotipo_Fundo_Tranparente.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Confirmei" className="h-8" />
            <span className="text-xl font-display font-bold text-foreground">Confirmei</span>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/auth")}
            className="rounded-full px-6"
          >
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/10" />
        <div className="container mx-auto px-4 py-20 lg:py-32 relative">
          <div className="max-w-3xl mx-auto text-center animate-slide-up">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-6 leading-tight">
              Gerencie seus convidados{" "}
              <span className="text-secondary">sem dor de cabeça.</span>
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Confirmação de presença, controle de convidados e check-in com QR Code. Tudo em um só lugar.
            </p>
            <Button
              onClick={() => navigate("/auth")}
              className="btn-gold rounded-full px-8 py-6 text-lg shadow-gold"
            >
              Criar meu evento
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          <FeatureCard
            icon={Calendar}
            title="Crie Eventos"
            description="Monte seu evento com identidade, capa e configurações personalizadas."
          />
          <FeatureCard
            icon={Users}
            title="Gerencie Convidados"
            description="Controle confirmações, acompanhantes e lista em tempo real."
          />
          <FeatureCard
            icon={QrCode}
            title="Check-in com QR Code"
            description="Entrada rápida, sem fila e sem bagunça."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 pb-16 lg:pb-24">
        <div className="card-elegant p-10 lg:p-16 text-center bg-gradient-to-br from-primary/5 to-secondary/10">
          <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground mb-4">
            Pronto para começar?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Crie sua conta gratuita e comece a organizar seus eventos hoje mesmo.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            className="btn-gold rounded-full px-8 py-5"
          >
            Criar conta grátis
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2027 Confirmei. Todos os direitos reservados.
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
  <div className="card-elegant p-6 lg:p-8 text-center hover:shadow-elegant-lg hover:-translate-y-1 transition-all duration-300">
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-secondary/15 text-primary mb-4">
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="text-lg font-display font-semibold text-foreground mb-2">
      {title}
    </h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
  </div>
);

export default Index;
