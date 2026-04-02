import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import logo from "@/assets/Logotipo_Fundo_Tranparente.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <img src={logo} alt="Convitei" className="h-9" />
          <Button
            variant="outline"
            onClick={() => navigate("/auth")}
            className="rounded-full px-6"
          >
            Entrar
          </Button>
        </div>
      </header>

      {/* Hero — full screen, centered */}
      <section className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-3xl text-center animate-slide-up">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-6 leading-tight">
            Gerencie seus convidados{" "}
            <span className="text-secondary">sem dor de cabeça.</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Confirmação de presença, controle de convidados e check-in com QR Code. Tudo em um só lugar.
          </p>
          <div className="flex flex-row items-center justify-center gap-4">
            <Button
              onClick={() => navigate("/auth")}
              className="btn-gold rounded-full px-8 py-6 text-lg"
            >
              Criar meu evento
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/auth")}
              className="rounded-full px-8 py-6 text-lg border-primary text-primary hover:bg-primary/5"
            >
              Já tenho conta
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2027 Convitei. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default Index;
