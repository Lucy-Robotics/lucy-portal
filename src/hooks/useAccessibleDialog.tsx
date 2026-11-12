import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusable(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

type UseAccessibleDialogOptions = {
  isOpen: boolean;
  onClose: () => void;
};

export function useAccessibleDialog({ isOpen, onClose }: UseAccessibleDialogOptions) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const pressStartedOnOverlay = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const frame = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusable(dialog);
      (focusable[0] ?? dialog).focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  // Press + release
  const onOverlayMouseDown = useCallback((event: ReactMouseEvent) => {
    pressStartedOnOverlay.current = event.target === event.currentTarget;
  }, []);

  const onOverlayClick = useCallback(
    (event: ReactMouseEvent) => {
      if (pressStartedOnOverlay.current && event.target === event.currentTarget) {
        onClose();
      }
      pressStartedOnOverlay.current = false;
    },
    [onClose]
  );

  return {
    titleId,
    dialogRef: dialogRef as RefObject<HTMLDivElement>,
    overlayProps: {
      onMouseDown: onOverlayMouseDown,
      onClick: onOverlayClick,
      onKeyDown,
    },
    dialogProps: {
      ref: dialogRef,
      role: 'dialog' as const,
      'aria-modal': true as const,
      'aria-labelledby': titleId,
      tabIndex: -1,
      onKeyDown,
    },
  };
}
