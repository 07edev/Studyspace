import { Badge, Card, PageHeader } from '../ui';

// Placeholder for a page that is planned but not built yet. It states that plainly instead of
// showing sample data, so nobody mistakes it for a working screen.
export function PendingPage({
  id, owner, title, needs,
}: { id: string; owner: string; title: string; needs?: string }) {
  return (
    <div className="page">
      <PageHeader title={title} actions={<Badge tone="warning">Chưa xây dựng</Badge>} />
      <Card>
        <p>
          Trang <strong>{id}</strong> do <strong>{owner}</strong> phụ trách và chưa được làm.
        </p>
        {needs && <p className="muted">Cần có: {needs}.</p>}
        <p className="muted">
          Người phụ trách thay nội dung ở <code>src/app/registry.tsx</code>; menu, đường dẫn và kiểm tra quyền đã sẵn sàng.
        </p>
      </Card>
    </div>
  );
}
