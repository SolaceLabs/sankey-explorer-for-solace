import { useEffect, useId, useRef, useState } from "react";

/**
 * Open/close state for a toolbar disclosure (a button that shows a panel,
 * not an ARIA menu). Closes on Escape - returning focus to the button - and
 * on a click outside the root element. Shared by the VPN, View and Live
 * traffic menus so they all behave the same.
 */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return {
    open,
    close: () => setOpen(false),
    rootRef,
    /** Spread onto the toggle button. */
    buttonProps: {
      ref: buttonRef,
      "aria-expanded": open,
      "aria-controls": panelId,
      onClick: () => setOpen((value) => !value),
    },
    panelId,
  };
}
