import { useMemo, useState } from 'react';
import type { ActivitySeries, ActivityStats, Granularity } from '@contracts/admin';
import { queryKeys, useApiQuery } from '../../lib/query';
import { Card, Checkbox, EmptyState, ErrorState, LoadingState, PageHeader, SelectField, TextField } from '../../ui';
import { LineChart } from '../../ui/charts/LineChart';
import { SegmentedControl } from './SegmentedControl';

const nf = new Intl.NumberFormat('vi-VN');
const SERIES: Record<ActivitySeries, { label: string; unit: string }> = {
  users: { label: 'Người dùng mới', unit: 'người' },
  places: { label: 'Địa điểm mới', unit: 'địa điểm' },
  posts: { label: 'Bài viết mới', unit: 'bài' },
  documents: { label: 'Tài liệu mới', unit: 'tài liệu' },
  reports: { label: 'Báo cáo mới', unit: 'báo cáo' },
};
const ALL_SERIES = Object.keys(SERIES) as ActivitySeries[];
const GRANULARITY_OPTIONS = [
  { value: 'DAY', label: 'Ngày' }, { value: 'WEEK', label: 'Tuần' }, { value: 'MONTH', label: 'Tháng' },
];
const PRESETS = [{ value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }, { value: 90, label: '90 ngày' }];
const MAX_DAYS = 366;

const DAY_MS = 86_400_000;
const todayVn = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const spanDays = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS + 1;

// How a bucket's first day is written on the axis and in the tooltip.
const labelFor = (granularity: Granularity) => (date: string) => {
  const [y, m, d] = date.split('-');
  if (granularity === 'MONTH') return `${m}/${y}`;
  return granularity === 'WEEK' ? `Tuần ${d}/${m}` : `${d}/${m}`;
};

// ADM-24 - Thong ke hoat dong. One small chart per measure (different scales are never put on one
// axis); the chart view and the table view show exactly the same numbers.
export function ActivityPage() {
  const [preset, setPreset] = useState<number | 'custom'>(30);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [granularity, setGranularity] = useState<Granularity>('DAY');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hidden, setHidden] = useState<ActivitySeries[]>([]);

  const range = useMemo(() => {
    if (preset !== 'custom') {
      const to = todayVn();
      return { from: addDays(to, -(preset - 1)), to };
    }
    return { from: customFrom, to: customTo };
  }, [preset, customFrom, customTo]);

  const rangeError =
    preset !== 'custom' ? undefined
      : !range.from || !range.to ? 'Chọn cả ngày bắt đầu và ngày kết thúc.'
      : range.from > range.to ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.'
      : spanDays(range.from, range.to) > MAX_DAYS ? `Khoảng thời gian tối đa ${MAX_DAYS} ngày.`
      : undefined;

  const params = { ...range, granularity };
  const query = useApiQuery<ActivityStats>(queryKeys.stats.activity(params), '/admin/statistics/activity', {
    query: params, enabled: !rangeError, keepPrevious: true,
  });
  const data = query.data;
  const shown = (data?.series ?? []).filter(s => !hidden.includes(s));
  const missing = ALL_SERIES.filter(s => data && !data.series.includes(s));
  const stale = query.isFetching;

  return (
    <div className="page">
      <PageHeader title="Thống kê hoạt động" description="Số mục mới theo thời gian (giờ Việt Nam). Mỗi chỉ số có biểu đồ riêng vì thang đo khác nhau." />

      {/* One row of filters above everything they scope. */}
      <Card>
        <div className="toolbar" role="search">
          <div className="field">
            <span className="label">Khoảng thời gian</span>
            <SegmentedControl<number | 'custom'>
              label="Khoảng thời gian" value={preset} onChange={setPreset}
              options={[...PRESETS, { value: 'custom', label: 'Tùy chọn' }]}
            />
          </div>
          {preset === 'custom' && (
            <>
              <TextField label="Từ ngày" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
              <TextField label="Đến ngày" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} error={rangeError} />
            </>
          )}
          <SelectField label="Nhóm theo" value={granularity} onChange={e => setGranularity(e.target.value as Granularity)} options={GRANULARITY_OPTIONS} />
          <div className="field">
            <span className="label">Hiển thị</span>
            <SegmentedControl<'chart' | 'table'>
              label="Kiểu hiển thị" value={view} onChange={setView}
              options={[{ value: 'chart', label: 'Biểu đồ' }, { value: 'table', label: 'Bảng' }]}
            />
          </div>
        </div>
        {data && data.series.length > 1 && (
          <div className="toolbar" style={{ marginTop: 12 }} role="group" aria-label="Chỉ số hiển thị">
            {data.series.map(s => (
              <Checkbox
                key={s} label={SERIES[s].label} checked={!hidden.includes(s)}
                onChange={e => setHidden(h => (e.target.checked ? h.filter(x => x !== s) : [...h, s]))}
              />
            ))}
          </div>
        )}
      </Card>

      {rangeError && preset === 'custom' && !data && <EmptyState title="Chọn khoảng thời gian" description={rangeError} />}
      {query.isPending && !rangeError && <LoadingState />}
      {query.error && !data && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}

      {data && (
        <div className={stale ? 'viz-stale' : undefined} aria-busy={stale || undefined}>
          {data.failedSources && data.failedSources.length > 0 && (
            <div className="banner" role="alert">Chưa lấy được số liệu từ: {data.failedSources.join(', ')}.</div>
          )}
          {shown.length === 0 ? (
            <EmptyState title="Chưa chọn chỉ số nào" description="Bật ít nhất một chỉ số ở trên." />
          ) : view === 'chart' ? (
            <div className="chart-grid">
              {shown.map(s => (
                <Card key={s}>
                  <LineChart
                    title={SERIES[s].label} unit={SERIES[s].unit} formatLabel={labelFor(data.granularity)}
                    points={data.items.map(p => ({ label: p.date, value: p[s] ?? 0 }))}
                  />
                </Card>
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">Số mục mới theo thời gian</caption>
                <thead>
                  <tr>
                    <th scope="col">{data.granularity === 'DAY' ? 'Ngày' : data.granularity === 'WEEK' ? 'Tuần bắt đầu' : 'Tháng'}</th>
                    {shown.map(s => <th key={s} scope="col">{SERIES[s].label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(p => (
                    <tr key={p.date}>
                      <th scope="row">{labelFor(data.granularity)(p.date)}</th>
                      {shown.map(s => <td key={s}>{nf.format(p[s] ?? 0)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {missing.length > 0 && (
            <p className="hint" style={{ marginTop: 12 }}>
              Chưa có số liệu: {missing.map(s => SERIES[s].label.replace(' mới', '').toLowerCase()).join(', ')}. Sẽ hiện khi module tương ứng được kết nối.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
