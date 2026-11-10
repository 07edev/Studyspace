/**
 * @format
 */

import React from 'react';
import { FlatList, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient } from '@tanstack/react-query';
import { ModalCoordinator, useModal } from '../src/navigation/ModalCoordinator';
import { ModalHost } from '../src/navigation/ModalHost';
import { ApiError, createApiClient } from '../src/shared/api/client';
import { AuthProvider } from '../src/shared/auth/AuthProvider';
import { SessionManager } from '../src/shared/auth/sessionManager';
import { createMemoryTokenStorage } from '../src/shared/auth/tokenStorage';
import type { Page } from '../src/shared/contracts/api';
import {
  createQueryClient,
  QueryProvider,
  queryKeys,
  shouldRetry,
  usePagedQuery,
  withQuery,
} from '../src/shared/query';
import {
  Avatar,
  Button,
  Checkbox,
  Chip,
  ConfirmProvider,
  PagedList,
  SelectField,
  ToastProvider,
  UploadPicker,
  useConfirm,
} from '../src/shared/ui';
import type { FileUploader, PickedFile } from '../src/shared/upload/types';
import { IMAGE_RULES } from '../src/shared/upload/types';

const act = ReactTestRenderer.act;
const settle = async (times = 4) => {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
};
const ok = (data: unknown) =>
  ({
    status: 200,
    ok: true,
    json: async () => ({ success: true, data, requestId: 'r' }),
    headers: { get: () => null },
  } as unknown as Response);
const failure = (status: number, code: string, message: string) =>
  ({
    status,
    ok: false,
    json: async () => ({ success: false, error: { code, message }, requestId: 'r' }),
    headers: { get: () => null },
  } as unknown as Response);

const user = {
  id: 'u1',
  email: 'an@example.test',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: true,
  authProviders: ['PASSWORD'],
  profile: { displayName: 'An' },
  createdAt: '2026-01-01T00:00:00.000Z',
};
const tokens = {
  accessToken: 'access-1',
  tokenType: 'Bearer',
  expiresInSeconds: 900,
  refreshToken: 'refresh-1',
};

function makeManager(
  routes: Record<string, () => Response | Promise<Response>> = {},
  storedToken: string | null = null,
) {
  const calls: string[] = [];
  const fetcher = jest.fn(async (url: string) => {
    const path = url.replace('https://api.test', '');
    calls.push(path);
    const handler = routes[path];
    if (!handler) {
      throw new Error(`unexpected ${path}`);
    }
    return handler();
  });
  const manager = new SessionManager(
    createApiClient({ baseUrl: 'https://api.test', fetcher: fetcher as never }),
    createMemoryTokenStorage(storedToken),
  );
  return { manager, calls };
}

let tree: ReactTestRenderer.ReactTestRenderer;
const text = () =>
  tree.root
    .findAllByType(Text)
    .map(t => [t.props.children].flat().join(''))
    .join(' | ');
const button = (title: string) => {
  const all = tree.root.findAllByType(Button).filter(b => b.props.title === title);
  return all[all.length - 1];
};
const press = async (title: string) => {
  const target = button(title);
  if (!target) {
    throw new Error(`no button "${title}" in: ${text()}`);
  }
  await act(async () => {
    await target.props.onPress();
  });
};
const byLabel = (label: string, role?: string) =>
  tree.root.find(
    n =>
      n.props?.accessibilityLabel === label &&
      typeof n.props?.onPress === 'function' &&
      (!role || n.props?.accessibilityRole === role),
  );
afterEach(async () => {
  await act(async () => tree.unmount());
});

// ---------------------------------------------------------------- confirm dialog
describe('useConfirm', () => {
  let ask!: ReturnType<typeof useConfirm>;
  let modal!: ReturnType<typeof useModal>;
  function Probe() {
    ask = useConfirm();
    modal = useModal();
    return null;
  }
  const mount = async () => {
    const { manager } = makeManager();
    await act(async () => {
      tree = ReactTestRenderer.create(
        <SafeAreaProvider>
          <ToastProvider>
            <AuthProvider manager={manager}>
              <ConfirmProvider>
                <ModalCoordinator>
                  <Probe />
                  <ModalHost onWelcome={() => undefined} onContinue={() => undefined} />
                </ModalCoordinator>
              </ConfirmProvider>
            </AuthProvider>
          </ToastProvider>
        </SafeAreaProvider>,
      );
    });
  };

  test('asks on a plain screen (no modal open) and resolves with the answer', async () => {
    await mount();
    let answer: boolean | undefined;
    await act(async () => {
      ask({ title: 'Xóa bài viết?', message: 'Không thể hoàn tác.', confirmLabel: 'Xóa', destructive: true }).then(
        value => {
          answer = value;
        },
      );
    });
    expect(text()).toContain('Xóa bài viết?');
    expect(text()).toContain('Không thể hoàn tác.');
    expect(button('Xóa').props.variant).toBe('danger');
    await press('Xóa');
    expect(answer).toBe(true);
    expect(text()).not.toContain('Xóa bài viết?');

    await act(async () => {
      ask({ title: 'Tiếp tục?' }).then(value => {
        answer = value;
      });
    });
    await press('Hủy');
    expect(answer).toBe(false);
  });

  test('can sit on top of an open modal without closing it', async () => {
    await mount();
    await act(async () => {
      modal.open({ name: 'about' });
    });
    expect(text()).toContain('Học tập có không gian.');
    let answer: boolean | undefined;
    await act(async () => {
      ask({ title: 'Chắc chưa?' }).then(value => {
        answer = value;
      });
    });
    expect(text()).toContain('Chắc chưa?');
    await press('Hủy');
    expect(answer).toBe(false);
    expect(modal.state.active?.name).toBe('about');
  });

  test('a newer question cancels the older one', async () => {
    await mount();
    const answers: Record<string, boolean | undefined> = {};
    await act(async () => {
      ask({ title: 'Câu một' }).then(value => {
        answers.first = value;
      });
    });
    await act(async () => {
      ask({ title: 'Câu hai' }).then(value => {
        answers.second = value;
      });
    });
    expect(answers.first).toBe(false);
    expect(text()).toContain('Câu hai');
    await press('Đồng ý');
    expect(answers.second).toBe(true);
  });
});

// ---------------------------------------------------------------- simple controls
describe('form controls', () => {
  test('Checkbox reports the new value and exposes its state to screen readers', async () => {
    const changes: boolean[] = [];
    await act(async () => {
      tree = ReactTestRenderer.create(
        <Checkbox label="Tôi đồng ý" checked={false} onChange={v => changes.push(v)} error="Cần đồng ý" />,
      );
    });
    const box = byLabel('Tôi đồng ý', 'checkbox');
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
    await act(async () => box.props.onPress());
    expect(changes).toEqual([true]);
    expect(text()).toContain('Cần đồng ý');
  });

  test('SelectField opens inline, picks one value and closes', async () => {
    const picked: string[] = [];
    await act(async () => {
      tree = ReactTestRenderer.create(
        <SelectField
          label="Học kỳ"
          value="B"
          options={[
            { value: 'A', label: 'Kỳ 1' },
            { value: 'B', label: 'Kỳ 2' },
          ]}
          onChange={v => picked.push(v)}
        />,
      );
    });
    expect(text()).toContain('Kỳ 2');
    expect(text()).not.toContain('Kỳ 1');
    await act(async () => byLabel('Học kỳ', 'button').props.onPress());
    expect(text()).toContain('Kỳ 1');
    expect(byLabel('Kỳ 2', 'radio').props.accessibilityState).toMatchObject({ selected: true });
    await act(async () => byLabel('Kỳ 1', 'radio').props.onPress());
    expect(picked).toEqual(['A']);
    expect(tree.root.findAll(n => n.props?.accessibilityRole === 'radio')).toHaveLength(0);
  });

  test('SelectField shows its placeholder and error', async () => {
    await act(async () => {
      tree = ReactTestRenderer.create(
        <SelectField label="Tỉnh" value={undefined} options={[]} onChange={() => undefined} error="Vui lòng chọn." />,
      );
    });
    expect(text()).toContain('Chọn một mục');
    expect(text()).toContain('Vui lòng chọn.');
  });

  test('Chip is a button only when it has an action', async () => {
    const taps: string[] = [];
    await act(async () => {
      tree = ReactTestRenderer.create(
        <>
          <Chip label="Gần tôi" selected onPress={() => taps.push('near')} />
          <Chip label="Thẻ" />
        </>,
      );
    });
    const filter = byLabel('Gần tôi', 'button');
    expect(filter.props.accessibilityState).toMatchObject({ selected: true });
    await act(async () => filter.props.onPress());
    expect(taps).toEqual(['near']);
    expect(tree.root.find(n => n.props?.accessibilityLabel === 'Thẻ' && n.props?.accessibilityRole === 'text')).toBeDefined();
  });

  test('Avatar falls back from picture to initials to an icon', async () => {
    await act(async () => {
      tree = ReactTestRenderer.create(
        <>
          <Avatar name="Nguyễn Văn an" />
          <Avatar name="Lan" />
          <Avatar />
        </>,
      );
    });
    expect(text()).toContain('NA');
    expect(text()).toContain('L');
    const labels = tree.root.findAll(n => n.props?.accessibilityRole === 'image').map(n => n.props?.accessibilityLabel);
    expect(labels).toEqual(expect.arrayContaining(['Ảnh đại diện của Nguyễn Văn an', 'Ảnh đại diện']));
  });
});

// ---------------------------------------------------------------- query layer
describe('query helpers', () => {
  test('withQuery skips empty values, encodes and repeats arrays', () => {
    expect(withQuery('/places')).toBe('/places');
    expect(withQuery('/places', { q: 'góc học', page: 2, province: undefined, empty: '', none: null })).toBe(
      '/places?q=g%C3%B3c%20h%E1%BB%8Dc&page=2',
    );
    expect(withQuery('/x?a=1', { tag: ['a', 'b'] })).toBe('/x?a=1&tag=a&tag=b');
  });

  test('query keys follow [domain, resource, ...params]', () => {
    expect(queryKeys.users.me()).toEqual(['users', 'me']);
    expect(queryKeys.places.list({ q: 'a' })).toEqual(['places', 'list', { q: 'a' }]);
    expect(queryKeys.places.detail('p1').slice(0, 2)).toEqual(['places', 'detail']);
  });

  test('retries only failures the server did not already answer', () => {
    expect(shouldRetry(0, new ApiError('NOT_FOUND', 'x', 404))).toBe(false);
    expect(shouldRetry(0, new ApiError('VALIDATION_ERROR', 'x', 422))).toBe(false);
    expect(shouldRetry(0, new ApiError('INTERNAL_ERROR', 'x', 500))).toBe(true);
    expect(shouldRetry(0, new TypeError('offline'))).toBe(true);
    expect(shouldRetry(2, new ApiError('INTERNAL_ERROR', 'x', 500))).toBe(false);
  });
});

function ListProbe({ path = '/items' }: { path?: string }) {
  const query = usePagedQuery<{ id: string; name: string }>(queryKeys.places.list({}), path, {}, { limit: 2 });
  return (
    <PagedList
      query={query}
      keyExtractor={item => item.id}
      renderItem={item => <Text>{item.name}</Text>}
      emptyTitle="Chưa có địa điểm"
      emptyDescription="Hãy quay lại sau."
    />
  );
}
const pageOf = (names: string[], page: number, hasNext: boolean): Page<{ id: string; name: string }> => ({
  items: names.map(name => ({ id: name, name })),
  pagination: { page, limit: 2, total: 3, totalPages: 2, hasNext },
});
async function mountList(
  routes: Record<string, () => Response | Promise<Response>>,
  client: QueryClient = createQueryClient(),
) {
  // Like the real app: a stored refresh token is restored by AuthProvider on mount.
  const { manager, calls } = makeManager(
    {
      '/auth/token/refresh': () => ok({ ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' }),
      '/auth/me': () => ok(user),
      ...routes,
    },
    'refresh-1',
  );
  await act(async () => {
    tree = ReactTestRenderer.create(
      <AuthProvider manager={manager}>
        <QueryProvider client={client}>
          <ListProbe />
        </QueryProvider>
      </AuthProvider>,
    );
  });
  await settle();
  return { manager, calls, client };
}

describe('PagedList + usePagedQuery', () => {
  test('shows the first page, then loads the next one when the end is reached', async () => {
    const { calls } = await mountList({
      '/items?page=1&limit=2': () => ok(pageOf(['Một', 'Hai'], 1, true)),
      '/items?page=2&limit=2': () => ok(pageOf(['Ba'], 2, false)),
    });
    expect(text()).toContain('Một');
    expect(text()).toContain('Hai');
    expect(text()).not.toContain('Ba');
    await act(async () => {
      tree.root.findByType(FlatList).props.onEndReached();
    });
    await settle();
    expect(text()).toContain('Ba');
    expect(calls.filter(c => c.startsWith('/items'))).toEqual(['/items?page=1&limit=2', '/items?page=2&limit=2']);
    // No further page exists: reaching the end again asks for nothing.
    await act(async () => {
      tree.root.findByType(FlatList).props.onEndReached();
    });
    await settle();
    expect(calls.filter(c => c.startsWith('/items'))).toHaveLength(2);
  });

  test('shows an empty state', async () => {
    await mountList({ '/items?page=1&limit=2': () => ok(pageOf([], 1, false)) });
    expect(text()).toContain('Chưa có địa điểm');
    expect(text()).toContain('Hãy quay lại sau.');
  });

  test('shows the error with a retry that works', async () => {
    let attempts = 0;
    await mountList({
      '/items?page=1&limit=2': () =>
        ++attempts === 1 ? failure(404, 'NOT_FOUND', 'Không tìm thấy.') : ok(pageOf(['Một'], 1, false)),
    });
    expect(text()).toContain('Không tìm thấy.');
    await press('Thử lại');
    await settle();
    expect(text()).toContain('Một');
    expect(attempts).toBe(2); // the 404 was not retried on its own
  });

  test('keeps the pages already shown when the next page fails, and offers a retry', async () => {
    let second = 0;
    await mountList({
      '/items?page=1&limit=2': () => ok(pageOf(['Một', 'Hai'], 1, true)),
      '/items?page=2&limit=2': () =>
        ++second === 1 ? failure(403, 'FORBIDDEN', 'Không có quyền.') : ok(pageOf(['Ba'], 2, false)),
    });
    await act(async () => {
      tree.root.findByType(FlatList).props.onEndReached();
    });
    await settle();
    expect(text()).toContain('Một');
    expect(text()).toContain('Chưa tải thêm được.');
    await press('Thử lại');
    await settle();
    expect(text()).toContain('Ba');
  });

  test('the cache is wiped when the user signs out', async () => {
    const { manager, client } = await mountList({
      '/items?page=1&limit=2': () => ok(pageOf(['Một'], 1, false)),
      '/auth/logout': () => ({ status: 204, ok: true, headers: { get: () => null } } as unknown as Response),
    });
    expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);
    await act(async () => {
      await manager.logout();
    });
    await settle(2);
    expect(client.getQueryCache().getAll().filter(q => q.state.data !== undefined)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- upload
describe('UploadPicker', () => {
  const photo: PickedFile = { uri: 'file:///a.jpg', name: 'a.jpg', mimeType: 'image/jpeg', sizeBytes: 2_000_000 };
  function fakeUploader(overrides: Partial<FileUploader> = {}): FileUploader & { uploads: PickedFile[] } {
    const uploads: PickedFile[] = [];
    return {
      uploads,
      pick: async () => photo,
      upload: async (file, onProgress) => {
        uploads.push(file);
        onProgress(0.5);
        return { fileId: 'f'.repeat(24) };
      },
      ...overrides,
    };
  }
  const mountPicker = async (uploader: FileUploader, onChange: (id: string | null) => void) => {
    await act(async () => {
      tree = ReactTestRenderer.create(
        <UploadPicker label="Ảnh đại diện" uploader={uploader} rules={IMAGE_RULES} onChange={onChange} chooseLabel="Chọn ảnh" />,
      );
    });
  };

  test('picks, uploads with progress and reports the READY file id', async () => {
    const reported: (string | null)[] = [];
    const uploader = fakeUploader();
    await mountPicker(uploader, id => reported.push(id));
    expect(reported).toEqual([]); // opening the screen reports nothing
    await press('Chọn ảnh');
    await settle();
    expect(uploader.uploads).toEqual([photo]);
    expect(reported).toEqual(['f'.repeat(24)]);
    expect(text()).toContain('Đã tải lên');
    await press('Gỡ');
    expect(reported).toEqual(['f'.repeat(24), null]);
    expect(text()).not.toContain('Đã tải lên');
  });

  test('closing the OS picker uploads nothing', async () => {
    const uploader = fakeUploader({ pick: async () => null });
    const reported: (string | null)[] = [];
    await mountPicker(uploader, id => reported.push(id));
    await press('Chọn ảnh');
    await settle();
    expect(uploader.uploads).toHaveLength(0);
    expect(reported).toEqual([]);
    expect(text()).not.toContain('Đang tải lên');
  });

  test('refuses a wrong type or an oversized file before any upload', async () => {
    const files = [
      { ...photo, name: 'b.pdf', mimeType: 'application/pdf' },
      { ...photo, name: 'c.jpg', sizeBytes: 20 * 1024 * 1024 },
    ];
    const uploader = fakeUploader({ pick: async () => files.shift() ?? null });
    await mountPicker(uploader, () => undefined);
    await press('Chọn ảnh');
    await settle();
    expect(text()).toContain('Định dạng tệp này không được hỗ trợ.');
    await press('Chọn tệp khác');
    await settle();
    expect(text()).toContain('Tệp quá lớn. Dung lượng tối đa là 10 MB.');
    expect(uploader.uploads).toHaveLength(0);
  });

  test('a failed upload explains itself and can be retried', async () => {
    let attempts = 0;
    const uploader = fakeUploader({
      upload: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiError('FILE_NOT_READY', 'Tệp chưa sẵn sàng.', 409);
        }
        return { fileId: 'e'.repeat(24) };
      },
    });
    const reported: (string | null)[] = [];
    await mountPicker(uploader, id => reported.push(id));
    await press('Chọn ảnh');
    await settle();
    expect(text()).toContain('Tệp chưa sẵn sàng.');
    expect(reported).toEqual([]);
    await press('Thử lại');
    await settle();
    expect(reported).toEqual(['e'.repeat(24)]);
  });

  test('cancelling aborts the upload and ignores its late result', async () => {
    let signal!: AbortSignal;
    let finish!: () => void;
    const uploader = fakeUploader({
      upload: (_file, _progress, abort) => {
        signal = abort;
        return new Promise(resolve => {
          finish = () => resolve({ fileId: 'd'.repeat(24) });
        });
      },
    });
    const reported: (string | null)[] = [];
    await mountPicker(uploader, id => reported.push(id));
    await press('Chọn ảnh');
    await settle();
    expect(text()).toContain('Đang tải lên');
    await press('Hủy');
    expect(signal.aborted).toBe(true);
    await act(async () => {
      finish();
    });
    await settle();
    expect(reported).toEqual([]);
    expect(text()).not.toContain('Đã tải lên');
  });
});

