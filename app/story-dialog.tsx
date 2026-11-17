import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import "./story-dialog.css";

export default function StoryDialog({
  label,
  className = "",
  busy = false,
  onClose,
  children,
}: {
  label: string;
  className?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`story-dialog ${className}`}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="story-dialog-tools">
        <button
          className="story-close"
          aria-label="Close details"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
