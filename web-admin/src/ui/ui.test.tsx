import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api';
import { ConfirmProvider, DataTable, Modal, ToastProvider, useConfirm, useSubmit, useToast, type Column } from '.';

const wrap = (node: React.ReactNode) =>
  render(
    <ToastProvider durationMs={50}>
      <ConfirmProvider>{node}</ConfirmProvider>
    </ToastProvider>,
  );

describe('useConfirm', () => {
  function Probe({ onAnswer }: { onAnswer: (v: boolean) => void }) {
    const confirm = useConfirm();
    return <button onClick={async () => onAnswer(await confirm({ title: 'Xóa?', message: 'Không hoàn tác', destructive: true, confirmLabel: 'Xóa' }))}>ask</button>;
  }

  it('resolves true on confirm, false on cancel and on Escape; focus starts on Cancel', async () => {
    const answers: boolean[] = [];
    wrap(<Probe onAnswer={v => answers.push(v)} />);
    await userEvent.click(screen.getByText('ask'));
    expect(screen.getByRole('button', { name: 'Hủy' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    await userEvent.click(screen.getByText('ask'));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    await userEvent.click(screen.getByText('ask'));
    await userEvent.keyboard('{Escape}');
    expect(answers).toEqual([true, false, false]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('Modal', () => {
  function Host({ dirty }: { dirty: boolean }) {
    const [open, setOpen] = useState(true);
    return open ? (
      <Modal title="Sửa" size="L" dirty={dirty} onClose={() => setOpen(false)}>
        <input aria-label="ten" />
      </Modal>
    ) : (
      <p>closed</p>
    );
  }

  it('closes on Escape when nothing was changed, and focuses the first field', async () => {
    wrap(<Host dirty={false} />);
    expect(screen.getByLabelText('ten')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('asks before discarding changes, and stays open if the person keeps editing', async () => {
    wrap(<Host dirty />);
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    const ask = await screen.findByRole('alertdialog');
    expect(within(ask).getByText('Rời khỏi form?')).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Hủy' }));
    expect(screen.getByRole('dialog', { name: 'Sửa' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rời đi' }));
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('closes on a backdrop click but not on a click inside', async () => {
    wrap(<Host dirty={false} />);
    await userEvent.click(screen.getByLabelText('ten'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('keeps Tab inside the dialog', async () => {
    wrap(<Host dirty={false} />);
    // field -> close button -> back to the field
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('ten')).toHaveFocus();
  });
});

describe('Toast', () => {
  it('shows a message and removes it after the duration', async () => {
    function Probe() {
      const toast = useToast();
      return <button onClick={() => toast('Đã lưu.')}>go</button>;
    }
    wrap(<Probe />);
    await userEvent.click(screen.getByText('go'));
    expect(screen.getByText('Đã lưu.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Đã lưu.')).not.toBeInTheDocument());
  });
});

describe('DataTable', () => {
  type Row = { id: string; name: string };
  const columns: Column<Row>[] = [{ key: 'name', header: 'Tên', render: r => r.name }];
  const page = (items: Row[], extra = {}) => ({
    items,
    pagination: { page: 1, limit: 20, total: items.length, totalPages: 2, hasNext: true, ...extra },
  });
  const base = { isPending: false, error: null, refetch: vi.fn() };
  const table = (query: object, onPageChange = vi.fn(), pageNo = 1) =>
    render(<DataTable<Row> query={{ ...base, ...query }} columns={columns} rowKey={r => r.id} page={pageNo} onPageChange={onPageChange} caption="Danh sách" />);

  it('shows loading, rows, empty and error states', () => {
    const { unmount } = table({ isPending: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    unmount();

    const rows = table({ data: page([{ id: '1', name: 'An' }, { id: '2', name: 'Bình' }]) });
    expect(screen.getByRole('table', { name: 'Danh sách' })).toBeInTheDocument();
    expect(screen.getByText('Bình')).toBeInTheDocument();
    rows.unmount();

    const empty = table({ data: page([]) });
    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
    empty.unmount();

    const refetch = vi.fn();
    table({ error: new ApiError('X', 'Máy chủ bận', 503, 'rid-9'), refetch });
    expect(screen.getByText('Máy chủ bận')).toBeInTheDocument();
    expect(screen.getByText('Mã yêu cầu: rid-9')).toBeInTheDocument();
  });

  it('retries on demand and pages forward/back within the limits', async () => {
    const refetch = vi.fn();
    const failing = table({ error: new ApiError('X', 'lỗi', 500), refetch });
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    failing.unmount();

    const onPageChange = vi.fn();
    table({ data: page([{ id: '1', name: 'An' }], { page: 2, hasNext: false }) }, onPageChange, 2);
    expect(screen.getByRole('button', { name: 'Sau' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Trước' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('keeps showing old rows while a refresh fails (no flash of an error)', () => {
    table({ data: page([{ id: '1', name: 'An' }]), error: new ApiError('X', 'lỗi', 500) });
    expect(screen.getByText('An')).toBeInTheDocument();
  });
});

describe('useSubmit', () => {
  it('blocks a second run while one is pending and maps 422 details to fields', async () => {
    const { result } = renderHook(() => useSubmit());
    let release!: () => void;
    const slow = () => new Promise<string>(resolve => (release = () => resolve('done')));
    let first!: Promise<string | undefined>;
    act(() => {
      first = result.current.run(slow);
    });
    await act(async () => {
      expect(await result.current.run(async () => 'second')).toBeUndefined();
    });
    await act(async () => {
      release();
      expect(await first).toBe('done');
    });

    await act(async () => {
      await result.current.run(() => {
        throw new ApiError('VALIDATION_ERROR', 'Dữ liệu chưa hợp lệ.', 422, 'r', [{ field: 'email', rule: 'isEmail', message: 'Sai email' }]);
      });
    });
    expect(result.current.fields).toEqual({ email: 'Sai email' });
    expect(result.current.message).toBeUndefined(); // the field explains it; no duplicate banner

    await act(async () => {
      await result.current.run(() => {
        throw new ApiError('RATE_LIMITED', 'Quá nhanh', 429);
      });
    });
    expect(result.current.message).toBe('Quá nhanh');
  });
});

describe('query provider smoke', () => {
  it('QueryClientProvider is usable in tests', () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}>ok</QueryClientProvider>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});
