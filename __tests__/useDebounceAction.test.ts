// __tests__/useDebounceAction.test.ts — Unit tests para hook de debounce
import { renderHook, act, cleanup } from '@testing-library/react-native';
import { useDebounceAction } from '../hooks/useDebounceAction';

describe('hooks/useDebounceAction', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    cleanup();
    jest.useRealTimers();
  });

  test('1 toque → ejecuta 1 vez', async () => {
    const fn = jest.fn();
    const { result } = await renderHook(() => useDebounceAction(fn));

    await act(async () => {
      result.current.ejecutar();
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('5 toques rápidos en < 600ms → ejecuta solo 1 vez', async () => {
    const fn = jest.fn();
    const { result } = await renderHook(() => useDebounceAction(fn, { lockMs: 600 }));

    await act(async () => {
      result.current.ejecutar();
      result.current.ejecutar();
      result.current.ejecutar();
      result.current.ejecutar();
      result.current.ejecutar();
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('2 toques separados por > lockMs → ejecuta 2 veces', async () => {
    const fn = jest.fn();
    const { result } = await renderHook(() => useDebounceAction(fn, { lockMs: 600 }));

    await act(async () => {
      result.current.ejecutar();
    });

    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(650);
    });

    await act(async () => {
      result.current.ejecutar();
    });

    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('isLocked es true inmediatamente después del toque y se libera tras lockMs', async () => {
    const fn = jest.fn();
    const { result } = await renderHook(() => useDebounceAction(fn, { lockMs: 600 }));

    expect(result.current.isLocked).toBe(false);

    await act(async () => {
      result.current.ejecutar();
    });

    expect(result.current.isLocked).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(650);
    });

    expect(result.current.isLocked).toBe(false);
  });
});
