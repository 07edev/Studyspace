import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type PropsWithChildren,
} from 'react';
import { initialModalState, modalReducer, type ModalState } from './modalState';
import type { ModalRoute } from './types';
type ModalContextValue = {
  state: ModalState;
  open: (route: ModalRoute) => void;
  close: () => void;
  setDirty: (value: boolean) => void;
  stay: () => void;
  discard: () => void;
};
const ModalContext = createContext<ModalContextValue | null>(null);
export function ModalCoordinator({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(modalReducer, initialModalState);
  const open = useCallback(
    (route: ModalRoute) => dispatch({ kind: 'open', route }),
    [],
  );
  const close = useCallback(() => dispatch({ kind: 'close' }), []);
  const setDirty = useCallback(
    (value: boolean) => dispatch({ kind: 'dirty', value }),
    [],
  );
  const stay = useCallback(() => dispatch({ kind: 'stay' }), []);
  const discard = useCallback(() => dispatch({ kind: 'discard' }), []);
  const value = useMemo(
    () => ({ state, open, close, setDirty, stay, discard }),
    [state, open, close, setDirty, stay, discard],
  );
  return (
    <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
  );
}
export function useModal() {
  const value = useContext(ModalContext);
  if (!value) {
    throw new Error('useModal must be used inside ModalCoordinator');
  }
  return value;
}
