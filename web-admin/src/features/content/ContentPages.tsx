import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AdminComment, AdminDocument, AdminPost, AdminReport } from '@contracts/admin';
import { useAdmin } from '../../auth/AuthProvider';
import { PermissionGate } from '../../auth/guards';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { queryKeys, useApiQuery, usePagedQuery } from '../../lib/query';
import {
  Badge, Button, Card, DataTable, ErrorState, LoadingState, Modal, ModalCancel, PageHeader,
  SelectField, TextArea, useSubmit, useToast, type Column,
} from '../../ui';

type ContentKind = 'posts' | 'comments' | 'documents';
type ContentRow = AdminPost | AdminComment | AdminDocument;
type ReportDecision = 'TAKE_DOWN' | 'NO_VIOLATION';

const STATUSES: Record<ContentKind, string[]> = {
  posts: ['DRAFT', 'PUBLISHED', 'HIDDEN', 'DELETED'],
  comments: ['PUBLISHED', 'HIDDEN', 'DELETED'],
  documents: ['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN', 'DELETED'],
};

const statusLabel = (status: string) => ({
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ duyệt',
  PUBLISHED: 'Đã đăng',
  APPROVED: 'Đã duyệt',
  HIDDEN: 'Đã ẩn',
  REJECTED: 'Từ chối',
  DELETED: 'Đã xóa',
  ASSIGNED: 'Đã giao',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Không vi phạm',
}[status] ?? status);

const statusTone = (status: string) =>
  status === 'PUBLISHED' || status === 'APPROVED' || status === 'RESOLVED'
    ? 'success'
    : status === 'PENDING' || status === 'ASSIGNED'
      ? 'warning'
      : status === 'HIDDEN' || status === 'REJECTED' || status === 'DISMISSED'
        ? 'danger'
        : 'neutral';

const contentTitle = (row: ContentRow): string => {
  if ('title' in row && typeof row.title === 'string') return row.title;
  if ('content' in row && typeof row.content === 'string') return row.content;
  if ('fileName' in row && typeof row.fileName === 'string') return row.fileName;
  return row.id;
};

const listConfig: Record<ContentKind, { title: string; path: string; permission: 'POSTS' | 'COMMENTS' | 'DOCUMENTS' }> = {
  posts: { title: 'Quản lý bài viết', path: '/admin/posts', permission: 'POSTS' },
  comments: { title: 'Quản lý bình luận', path: '/admin/comments', permission: 'COMMENTS' },
  documents: { title: 'Quản lý tài liệu', path: '/admin/documents', permission: 'DOCUMENTS' },
};

function ModerationPage({ kind }: { kind: ContentKind }) {
  const config = listConfig[kind];
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<ContentRow>();
  const filters = { status };
  const keys = { posts: queryKeys.posts, comments: queryKeys.comments, documents: queryKeys.documents }[kind];
  const list = usePagedQuery<ContentRow>(keys.list(filters), config.path, filters);
  const columns: Column<ContentRow>[] = [
    {
      key: 'content',
      header: kind === 'documents' ? 'Tài liệu' : 'Nội dung',
      render: row => (
        <div>
          <strong>{contentTitle(row)}</strong>
          <div className="muted">{row.id}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Trạng thái', render: row => <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge> },
    { key: 'created', header: 'Ngày tạo', render: row => formatDateTime(row.createdAt) },
    {
      key: 'action',
      header: '',
      render: row => (
        <Button variant="secondary" small onClick={() => setSelected(row)} aria-label={`Xem ${contentTitle(row)}`}>
          Xem / xử lý
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader title={config.title} description="Tra cứu nội dung và xem lịch sử trạng thái kiểm duyệt." />
      <Card>
        <div className="toolbar" role="search">
          <SelectField
            label="Trạng thái"
            value={status}
            onChange={event => setStatus(event.target.value)}
            options={STATUSES[kind].map(value => ({ value, label: statusLabel(value) }))}
            placeholder="Tất cả"
          />
        </div>
      </Card>
      <DataTable
        query={list}
        columns={columns}
        rowKey={row => row.id}
        page={list.page}
        onPageChange={list.setPage}
        caption={config.title}
        emptyTitle="Chưa có nội dung"
      />
      {selected && (
        <ContentModerationModal kind={kind} row={selected} permission={config.permission} onClose={() => setSelected(undefined)} />
      )}
    </div>
  );
}

export function PostsAdminPage() {
  return <ModerationPage kind="posts" />;
}

export function CommentsAdminPage() {
  return <ModerationPage kind="comments" />;
}

export function DocumentsAdminPage() {
  return <ModerationPage kind="documents" />;
}

function ContentModerationModal({
  kind, row, permission, onClose,
}: {
  kind: ContentKind;
  row: ContentRow;
  permission: 'POSTS' | 'COMMENTS' | 'DOCUMENTS';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const submit = useSubmit();
  const [reason, setReason] = useState('');
  const actions = kind === 'documents'
    ? row.status === 'PENDING' ? ['APPROVE', 'REJECT'] : row.status === 'APPROVED' ? ['HIDE'] : []
    : row.status === 'PUBLISHED' ? ['HIDE'] : row.status === 'HIDDEN' ? ['RESTORE'] : [];
  const [action, setAction] = useState(actions[0] ?? '');
  const canSubmit = action === 'APPROVE' || reason.trim().length >= 10;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const body = {
      action,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      expectedVersion: row.version,
    };
    const result = await submit.run(() =>
      api.request<unknown>(`${listConfig[kind].path}/${row.id}/moderation`, { method: 'PATCH', body }),
    );
    if (!result) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys[kind].all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all }),
    ]);
    toast('Đã cập nhật trạng thái nội dung.');
    onClose();
  };

  return (
    <Modal title="Chi tiết và kiểm duyệt" size="L" onClose={onClose} dirty={reason !== ''}>
      <dl className="facts">
        <dt>Mã nội dung</dt><dd>{row.id}</dd>
        <dt>Người tạo</dt><dd>{row.authorId}</dd>
        <dt>Trạng thái</dt><dd><Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge></dd>
        <dt>Nội dung</dt><dd><pre className="json-box">{contentTitle(row)}</pre></dd>
        <dt>Ngày tạo</dt><dd>{formatDateTime(row.createdAt)}</dd>
      </dl>
      {actions.length > 0 ? (
        <PermissionGate access={{ module: permission, action: 'MODERATE' }} fallback={<p className="muted">Bạn chỉ có quyền xem nội dung.</p>}>
          <form className="form" onSubmit={save} noValidate>
            <SelectField
              label="Thao tác"
              value={action}
              onChange={event => setAction(event.target.value)}
              options={actions.map(value => ({
                value,
                label: ({ APPROVE: 'Duyệt', REJECT: 'Từ chối', HIDE: 'Ẩn', RESTORE: 'Khôi phục' } as Record<string, string>)[value],
              }))}
            />
            {action !== 'APPROVE' && (
              <TextArea label="Lý do" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} hint="Tối thiểu 10 ký tự." />
            )}
            {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
            <div className="modal-actions">
              <ModalCancel />
              <Button type="submit" variant={action === 'HIDE' || action === 'REJECT' ? 'danger' : 'primary'} loading={submit.pending} disabled={!canSubmit}>
                Xác nhận
              </Button>
            </div>
          </form>
        </PermissionGate>
      ) : <p className="muted">Không có thao tác kiểm duyệt phù hợp với trạng thái hiện tại.</p>}
    </Modal>
  );
}

export function ReportsAdminPage() {
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const filters = { status };
  const list = usePagedQuery<AdminReport>(queryKeys.reports.list(filters), '/admin/reports', filters);
  const columns: Column<AdminReport>[] = [
    { key: 'target', header: 'Nội dung bị báo cáo', render: report => <div><strong>{report.targetType}</strong><div className="muted">{report.targetId}</div></div> },
    { key: 'reason', header: 'Lý do', render: report => report.reasonCode },
    { key: 'status', header: 'Trạng thái', render: report => <Badge tone={statusTone(report.status)}>{statusLabel(report.status)}</Badge> },
    { key: 'created', header: 'Ngày gửi', render: report => formatDateTime(report.createdAt) },
    { key: 'action', header: '', render: report => <Button variant="secondary" small onClick={() => setSelectedId(report.id)}>Chi tiết</Button> },
  ];
  return (
    <div className="page">
      <PageHeader title="Báo cáo nội dung" description="Phân công, xem bằng chứng và ra quyết định kiểm duyệt." />
      <Card>
        <div className="toolbar" role="search">
          <SelectField
            label="Trạng thái"
            value={status}
            onChange={event => setStatus(event.target.value)}
            options={['PENDING', 'ASSIGNED', 'RESOLVED', 'DISMISSED'].map(value => ({ value, label: statusLabel(value) }))}
            placeholder="Tất cả"
          />
        </div>
      </Card>
      <DataTable query={list} columns={columns} rowKey={report => report.id} page={list.page} onPageChange={list.setPage} caption="Báo cáo nội dung" emptyTitle="Chưa có báo cáo" />
      {selectedId && <ReportDetailModal reportId={selectedId} onClose={() => setSelectedId(undefined)} />}
    </div>
  );
}

function ReportDetailModal({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const admin = useAdmin();
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useApiQuery<AdminReport>(
    queryKeys.reports.detail(reportId),
    `/admin/reports/${reportId}`,
  );
  const submit = useSubmit();
  const [decision, setDecision] = useState<ReportDecision>();
  const [reason, setReason] = useState('');
  const report = query.data;
  const canDecide = !!report && !['RESOLVED', 'DISMISSED'].includes(report.status);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all }),
    ]);
  };

  const assignToMe = async () => {
    if (!report) return;
    const updated = await submit.run(() =>
      api.request<unknown>(`/admin/reports/${report.id}/assignment`, {
        method: 'PATCH',
        body: { assigneeId: admin.id, expectedVersion: report.version },
      }),
    );
    if (!updated) return;
    await refresh();
    await query.refetch();
    toast('Đã giao báo cáo cho bạn.');
  };

  const decide = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!report || !decision || reason.trim().length < 10) return;
    const body = {
      action: decision,
      reason: reason.trim(),
      expectedVersion: report.version,
      ...(decision === 'TAKE_DOWN' ? { expectedTargetVersion: report.targetVersion } : {}),
    };
    const updated = await submit.run(() =>
      api.request<unknown>(`/admin/reports/${report.id}/decision`, { method: 'PATCH', body }),
    );
    if (!updated) return;
    await refresh();
    await query.refetch();
    toast(decision === 'TAKE_DOWN' ? 'Đã xử lý và ẩn nội dung.' : 'Đã ghi nhận không vi phạm.');
    setDecision(undefined);
    setReason('');
  };

  const openEvidence = async (fileId: string) => {
    const access = await submit.run(() => api.request<{ url: string }>(`/files/${fileId}/access`));
    if (access) window.open(access.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal title="Chi tiết báo cáo" size="L" onClose={onClose} dirty={reason !== ''}>
      {query.isPending && <LoadingState />}
      {query.error && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {report && (
        <>
          <dl className="facts">
            <dt>Mã báo cáo</dt><dd>{report.id}</dd>
            <dt>Người gửi</dt><dd>{report.reporterId}</dd>
            <dt>Nội dung</dt><dd>{report.targetType} · {report.targetId}</dd>
            <dt>Lý do</dt><dd>{report.reasonCode}</dd>
            <dt>Mô tả</dt><dd>{report.description || '—'}</dd>
            <dt>Trạng thái</dt><dd><Badge tone={statusTone(report.status)}>{statusLabel(report.status)}</Badge></dd>
            <dt>Đang xử lý</dt><dd>{report.assignedTo ?? 'Chưa phân công'}</dd>
            {report.decisionReason && <><dt>Kết luận</dt><dd>{report.decisionReason}</dd></>}
          </dl>
          {report.evidenceFileIds.length > 0 && (
            <section>
              <h3>Bằng chứng</h3>
              <div className="toolbar">
                {report.evidenceFileIds.map(fileId => (
                  <Button key={fileId} variant="secondary" small onClick={() => void openEvidence(fileId)}>
                    Mở {fileId.slice(-8)}
                  </Button>
                ))}
              </div>
            </section>
          )}
          {submit.message && <div className="form-error" role="alert">{submit.message}</div>}
          <PermissionGate access={{ module: 'REPORTS', action: 'ASSIGN' }}>
            {canDecide && <Button variant="secondary" loading={submit.pending} onClick={() => void assignToMe()}>Giao cho tôi</Button>}
          </PermissionGate>
          <PermissionGate access={{ module: 'REPORTS', action: 'MODERATE' }}>
            {canDecide && !decision && (
              <div className="modal-actions">
                <Button variant="danger" onClick={() => setDecision('TAKE_DOWN')}>Ẩn nội dung</Button>
                <Button variant="secondary" onClick={() => setDecision('NO_VIOLATION')}>Không vi phạm</Button>
              </div>
            )}
            {decision && (
              <form className="form" onSubmit={decide} noValidate>
                <TextArea
                  label="Lý do quyết định"
                  value={reason}
                  onChange={event => setReason(event.target.value)}
                  maxLength={1000}
                  hint={decision === 'TAKE_DOWN' ? `Sẽ ẩn nội dung (phiên bản ${report.targetVersion}). Tối thiểu 10 ký tự.` : 'Tối thiểu 10 ký tự.'}
                />
                <div className="modal-actions">
                  <Button variant="ghost" onClick={() => { setDecision(undefined); setReason(''); }}>Hủy</Button>
                  <Button type="submit" variant={decision === 'TAKE_DOWN' ? 'danger' : 'primary'} loading={submit.pending} disabled={reason.trim().length < 10}>Xác nhận</Button>
                </div>
              </form>
            )}
          </PermissionGate>
          <div className="modal-actions"><Button variant="secondary" onClick={onClose}>Đóng</Button></div>
        </>
      )}
    </Modal>
  );
}
