import type { ReactNode } from "react";

interface ErrorBannerProps {
  children: ReactNode;
  className?: string;
}

/** Red error banner for API/tool failures. */
export default function ErrorBanner({ children, className = "" }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={`rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 ${className}`}
    >
      {children}
    </div>
  );
}
