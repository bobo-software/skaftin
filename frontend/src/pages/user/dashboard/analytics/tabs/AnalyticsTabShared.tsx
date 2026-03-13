import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TimeSeriesDataPoint } from '../../../../../services/AnalyticsService';

export const MetricCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  trend: number | null;
  trendLabel?: string;
  color: 'blue' | 'green' | 'purple';
}) => {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded ${colorClasses[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-dark-500 dark:text-dark-400 truncate">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-dark-900 dark:text-white">{value}</p>
            <p className="text-[10px] text-dark-500 truncate">{subtitle}</p>
          </div>
        </div>
      </div>
      {trend !== null && trend > 0 && (
        <div className="mt-2 pt-2 border-t border-dark-100 dark:border-dark-700 flex items-center gap-1">
          {trend > 5 ? (
            <TrendingUp className="w-3 h-3 text-red-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-green-500" />
          )}
          <span className="text-[10px] text-dark-500">
            {trendLabel}: {trend.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

export const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-dark-500 dark:text-dark-400">{label}</span>
    <span className="font-medium text-dark-900 dark:text-white">{value}</span>
  </div>
);

export const AnalyticsChart = ({
  data,
  series,
}: {
  data: TimeSeriesDataPoint[];
  series: { key: keyof TimeSeriesDataPoint; label: string; color: string }[];
}) => {
  if (data.length === 0) {
    return <div className="text-center py-8 text-dark-500 text-xs">No data available</div>;
  }

  const formatted = data.map((d) => ({
    ...d,
    requestCount: d.requestCount ?? (d as any).request_count ?? 0,
    avgResponseTime: d.avgResponseTime ?? (d as any).avg_response_time ?? 0,
    errorCount: d.errorCount ?? (d as any).error_count ?? 0,
    queryCount: d.queryCount ?? (d as any).query_count ?? 0,
    avgExecutionTime: d.avgExecutionTime ?? (d as any).avg_execution_time ?? 0,
    totalRowsAffected: d.totalRowsAffected ?? (d as any).total_rows_affected ?? 0,
    uploadCount: d.uploadCount ?? (d as any).upload_count ?? 0,
    downloadCount: d.downloadCount ?? (d as any).download_count ?? 0,
    totalBytes: d.totalBytes ?? (d as any).total_bytes ?? 0,
    _label: new Date(d.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key as string} id={`grad-${s.key as string}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
        <XAxis
          dataKey="_label"
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-dark-800, #1e293b)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontSize: '11px',
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}
          itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />}
        {series.map((s) => (
          <Area
            key={s.key as string}
            type="monotone"
            dataKey={s.key as string}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#grad-${s.key as string})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};
