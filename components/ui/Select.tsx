import { useId } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

/** Labeled select with the standard control styling. Safe in client components only. */
export default function Select({ label, id, className = "", children, ...rest }: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  return (
    <div>
      {label ? (
        <label htmlFor={controlId} className="mb-1.5 block text-[12.5px] font-bold text-navy">
          {label}
        </label>
      ) : null}
      <select
        id={controlId}
        className={`block w-full px-3.5 py-2.5 border border-border rounded-[10px] bg-white focus:outline-none focus:border-blue focus:ring-[3px] focus:ring-fp-500/15 text-foreground text-[14px] ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
