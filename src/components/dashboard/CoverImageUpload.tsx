import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ImageIcon, Loader2, X } from "lucide-react";

interface CoverImageUploadProps {
  userId: string;
  coverUrl: string | null;
  onUpload: (url: string) => void;
  onRemove: () => void;
}

const CoverImageUpload = ({
  userId,
  coverUrl,
  onUpload,
  onRemove,
}: CoverImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Use JPG, PNG ou WebP",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("event-covers")
        .getPublicUrl(fileName);

      onUpload(urlData.publicUrl);
      
      toast({
        title: "Imagem carregada!",
        description: "A foto de capa foi enviada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        id="cover-upload"
      />

      {coverUrl ? (
        <div className="relative rounded-xl overflow-hidden">
          <img
            src={coverUrl}
            alt="Capa do evento"
            className="w-full h-48 object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 p-2 bg-background/80 hover:bg-background rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor="cover-upload"
          className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center"
        >
          {uploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground/50 mb-3" />
          )}
          <p className="text-muted-foreground font-medium">
            {uploading ? "Enviando..." : "Clique para selecionar uma imagem"}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            JPG, PNG ou WebP (máx. 5 MB)
          </p>
        </label>
      )}
    </div>
  );
};

export default CoverImageUpload;
