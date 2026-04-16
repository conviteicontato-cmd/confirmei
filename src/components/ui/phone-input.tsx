import React from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface PhoneInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const PhoneInputField = ({ value, onChange, placeholder, className, id }: PhoneInputFieldProps) => {
  return (
    <div className={cn("phone-input-wrapper", className)}>
      <PhoneInput
        id={id}
        international
        defaultCountry="BR"
        value={value}
        onChange={(v) => onChange(v || "")}
        placeholder={placeholder || "+55 21 99999-9999"}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:text-sm"
      />
    </div>
  );
};

export default PhoneInputField;
