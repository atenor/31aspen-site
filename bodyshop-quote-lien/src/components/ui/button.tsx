import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "destructive" | "outline";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variants: Record<Variant, string> = {
  default: "bg-primary text-white hover:opacity-90",
  secondary: "bg-accent text-accent-foreground hover:opacity-90",
  destructive: "bg-red-600 text-white hover:opacity-90",
  outline: "border border-border bg-white text-foreground hover:bg-muted"
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
