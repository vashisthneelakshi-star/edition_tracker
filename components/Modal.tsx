"use client";

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-ink/40 flex items-start justify-center pt-16 z-50"
      onClick={onClose}
    >
      <div
        className={`bg-card border border-rule w-full ${wide ? "max-w-2xl" : "max-w-md"} mx-4 max-h-[80vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-rule">
          <h2 className="font-serif text-[17px] font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-ink-soft hover:text-ink text-[18px] leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
