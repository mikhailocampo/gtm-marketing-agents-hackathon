"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type RadioContextValue = {
  name: string;
  value: string | undefined;
  onChange: (v: string) => void;
};
const RadioContext = React.createContext<RadioContextValue | null>(null);

export function RadioGroup({
  name,
  value,
  onValueChange,
  className,
  children,
}: {
  name: string;
  value?: string;
  onValueChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadioContext.Provider value={{ name, value, onChange: onValueChange }}>
      <div role="radiogroup" className={cn("flex flex-col gap-2", className)}>
        {children}
      </div>
    </RadioContext.Provider>
  );
}

export function RadioGroupItem({
  value,
  id,
  className,
}: {
  value: string;
  id?: string;
  className?: string;
}) {
  const ctx = React.useContext(RadioContext);
  if (!ctx) throw new Error("RadioGroupItem must be inside RadioGroup");
  return (
    <input
      id={id}
      type="radio"
      name={ctx.name}
      value={value}
      checked={ctx.value === value}
      onChange={() => ctx.onChange(value)}
      className={cn(
        "h-4 w-4 border border-border accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    />
  );
}
