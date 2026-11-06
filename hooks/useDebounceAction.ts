// hooks/useDebounceAction.ts — Hook para prevención de doble toque / Submit antidesborde
import { useState, useRef, useCallback } from 'react';

export interface UseDebounceActionOptions {
  /** Tiempo en ms durante el cual se ignora cualquier toque subsiguiente (default: 600ms) */
  lockMs?: number;
  /** Máximo número de toques permitidos en una ventana (opcional) */
  maxToques?: number;
  /** Tiempo de ventana para reseteo de toques (opcional) */
  ventanaMs?: number;
}

export interface UseDebounceActionResult {
  /** Función envuelta con protección de debounce */
  ejecutar: () => void;
  /** Estado que indica si la acción está bloqueada actualmente */
  isLocked: boolean;
}

export function useDebounceAction(
  action: () => void | Promise<void>,
  options: UseDebounceActionOptions = {}
): UseDebounceActionResult {
  const { lockMs = 600 } = options;
  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ejecutar = useCallback(() => {
    if (isLockedRef.current) {
      return;
    }

    isLockedRef.current = true;
    setIsLocked(true);

    try {
      const res = action();
      if (res && typeof res.then === 'function') {
        res.finally(() => {
          timeoutRef.current = setTimeout(() => {
            isLockedRef.current = false;
            setIsLocked(false);
          }, lockMs);
        });
        return;
      }
    } catch (e) {
      // Si ocurre un error síncrono, mantenemos el lock durante lockMs antes de liberar
    }

    timeoutRef.current = setTimeout(() => {
      isLockedRef.current = false;
      setIsLocked(false);
    }, lockMs);
  }, [action, lockMs]);

  return { ejecutar, isLocked };
}
