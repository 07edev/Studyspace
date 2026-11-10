import type { ModalRoute } from './types';
type Transition = { kind: 'close' } | { kind: 'open'; route: ModalRoute };
export type ModalState = {
  active: ModalRoute | null;
  dirty: boolean;
  pending: Transition | null;
  revision: number;
};
export type ModalAction =
  | Transition
  | { kind: 'dirty'; value: boolean }
  | { kind: 'stay' }
  | { kind: 'discard' };
export const initialModalState: ModalState = {
  active: null,
  dirty: false,
  pending: null,
  revision: 0,
};
function transition(state: ModalState, action: Transition): ModalState {
  return {
    active: action.kind === 'open' ? action.route : null,
    dirty: false,
    pending: null,
    revision: state.revision + 1,
  };
}
export function modalReducer(
  state: ModalState,
  action: ModalAction,
): ModalState {
  switch (action.kind) {
    case 'dirty':
      return { ...state, dirty: !!state.active && action.value };
    case 'stay':
      return { ...state, pending: null };
    case 'discard':
      return state.pending ? transition(state, state.pending) : state;
    case 'close':
    case 'open':
      if (state.pending) {
        return state;
      }
      return state.active && state.dirty
        ? { ...state, pending: action }
        : transition(state, action);
  }
}
