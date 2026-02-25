import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  iconColor?: string;
  borderColor?: string;
  valueColor?: string;
  badge?: number;
  badgeColor?: "destructive" | "warning" | "default";
  onClick?: () => void;
  description?: string;
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  iconColor = "text-muted-foreground",
  borderColor,
  valueColor,
  badge,
  badgeColor = "destructive",
  onClick,
  description,
}: StatCardProps) => {
  const isClickable = !!onClick;
  
  return (
    <Card 
      className={cn(
        borderColor,
        isClickable && "cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="relative">
          <Icon className={cn("h-4 w-4", iconColor)} />
          {badge !== undefined && badge > 0 && (
            <Badge 
              variant={badgeColor === "destructive" ? "destructive" : "outline"}
              className={cn(
                "absolute -top-2 -right-3 h-5 min-w-5 flex items-center justify-center text-xs px-1",
                badgeColor === "warning" && "bg-amber-500 text-white border-amber-500"
              )}
            >
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueColor)}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {isClickable && (
          <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            Clique para ver detalhes →
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;
