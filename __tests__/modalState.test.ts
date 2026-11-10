import { initialModalState, modalReducer } from '../src/navigation/modalState';

test('replaces the active modal instead of stacking auth dialogs', () => {
  const state = modalReducer(initialModalState, {
    kind: 'open',
    route: { name: 'auth-required', reason: 'Sign in' },
  });
  const next = modalReducer(state, {
    kind: 'open',
    route: { name: 'auth', mode: 'login' },
  });
  expect(next.active).toEqual({ name: 'auth', mode: 'login' });
  expect(next.pending).toBeNull();
});

test('keeps dirty content mounted until the user chooses to discard', () => {
  let state = modalReducer(initialModalState, {
    kind: 'open',
    route: { name: 'auth', mode: 'register' },
  });
  state = modalReducer(state, { kind: 'dirty', value: true });
  const revision = state.revision;
  state = modalReducer(state, { kind: 'close' });
  expect(state.active).toEqual({ name: 'auth', mode: 'register' });
  expect(state.revision).toBe(revision);
  state = modalReducer(state, { kind: 'stay' });
  expect(state.dirty).toBe(true);
  expect(state.pending).toBeNull();
  state = modalReducer(state, { kind: 'close' });
  state = modalReducer(state, { kind: 'discard' });
  expect(state.active).toBeNull();
  expect(state.dirty).toBe(false);
});

test('a later request cannot overwrite a pending dirty-form decision', () => {
  let state = modalReducer(initialModalState, {
    kind: 'open',
    route: { name: 'auth', mode: 'register' },
  });
  state = modalReducer(state, { kind: 'dirty', value: true });
  state = modalReducer(state, {
    kind: 'open',
    route: { name: 'auth', mode: 'login' },
  });
  state = modalReducer(state, { kind: 'open', route: { name: 'settings' } });
  state = modalReducer(state, { kind: 'discard' });
  expect(state.active).toEqual({ name: 'auth', mode: 'login' });
});
