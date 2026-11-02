interface ToastProps {
  tone: "error" | "success";
  message: string;
  onClose: () => void;
}

const TONE_CLASS: Record<ToastProps["tone"], string> = {
  error: "border-rose-200 bg-rose-50 text-rose-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const TONE_TITLE: Record<ToastProps["tone"], string> = {
  error: "Error",
  success: "Done",
};

/** Fixed bottom-right notice toast. Presentational — the parent drives visibility + auto-dismiss. */
export default function Toast({ tone, message, onClose }: ToastProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`fixed bottom-5 right-5 z-50 max-w-sm rounded-[12px] border px-4 py-3 shadow-lg animate-fade-in ${TONE_CLASS[tone]}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold">{TONE_TITLE[tone]}</p>
          <p className="mt-0.5 text-[13px] text-muted leading-snug">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-auto shrink-0 text-muted hover:text-navy cursor-pointer leading-none"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}