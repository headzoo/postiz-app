import { FC, useMemo } from 'react';
import { Integration } from '@prisma/client';
import {
  AnalyticsValueMode,
  ChartSocial,
  sortAnalyticsPoints,
} from '@gitroom/frontend/components/analytics/chart-social';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { usePlatformAnalytics } from '@gitroom/frontend/components/platform-analytics/use.platform.analytics';

export type AnalyticsDisplayUnit =
  | 'count'
  | 'percentage'
  | 'duration'
  | 'decimal';

export interface AnalyticsDataItem {
  label: string;
  data: Array<{ total: number; date: string }>;
  valueMode?: AnalyticsValueMode;
  displayUnit?: AnalyticsDisplayUnit;
  average?: boolean;
  percentageChange?: number;
}

export const resolveValueMode = (item: AnalyticsDataItem): AnalyticsValueMode => {
  if (item.valueMode) {
    return item.valueMode;
  }

  if (item.average) {
    return 'average';
  }

  return 'sum';
};

export const resolveDisplayUnit = (
  item: AnalyticsDataItem
): AnalyticsDisplayUnit => {
  if (item.displayUnit) {
    return item.displayUnit;
  }

  const mode = resolveValueMode(item);
  if (mode === 'average') {
    return 'percentage';
  }

  return 'count';
};

export const formatDuration = (seconds: number): string => {
  const rounded = Math.round(seconds);
  if (rounded < 60) {
    return `${rounded}s`;
  }

  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export const formatAnalyticsValue = (
  value: number,
  displayUnit: AnalyticsDisplayUnit
): string => {
  switch (displayUnit) {
    case 'percentage':
      return `${value.toFixed(2)}%`;
    case 'duration':
      return formatDuration(value);
    case 'decimal':
      return value.toFixed(2);
    default:
      return new Intl.NumberFormat().format(Math.round(value));
  }
};

export const analyticsTotal = (item: AnalyticsDataItem) => {
  const sorted = sortAnalyticsPoints(item.data);
  const mode = resolveValueMode(item);
  const displayUnit = resolveDisplayUnit(item);

  if (sorted.length === 0) {
    return formatAnalyticsValue(0, displayUnit);
  }

  let value: number;
  if (mode === 'sum') {
    value = sorted.reduce((acc, curr) => acc + curr.total, 0);
  } else if (mode === 'average') {
    value =
      sorted.reduce((acc, curr) => acc + curr.total, 0) / sorted.length;
  } else {
    value = sorted[sorted.length - 1].total;
  }

  return formatAnalyticsValue(value, displayUnit);
};

const TrendIndicator: FC<{
  value: number;
  valueMode: AnalyticsValueMode;
  displayUnit: AnalyticsDisplayUnit;
}> = ({ value, valueMode, displayUnit }) => {
  if (value === 0) return null;

  const isPositive = value > 0;
  const displayValue = Math.abs(value).toFixed(1);
  const suffix =
    valueMode === 'average' && displayUnit === 'percentage'
      ? 'pp'
      : valueMode === 'average'
        ? ''
        : '%';

  return (
    <div
      className={`flex items-center gap-[4px] text-[13px] font-medium ${
        isPositive ? 'text-[#32d583]' : 'text-[#f97066]'
      }`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className={isPositive ? '' : 'rotate-180'}
      >
        <path
          d="M6 2.5L10 7.5H2L6 2.5Z"
          fill="currentColor"
        />
      </svg>
      <span>
        {displayValue}
        {suffix}
      </span>
    </div>
  );
};

export const AnalyticsCard: FC<{
  item: AnalyticsDataItem;
  total: string | number;
  index: number;
}> = ({ item, total, index }) => {
  const colorVariants = ['purple', 'green', 'blue'] as const;
  const color = colorVariants[index % colorVariants.length];
  const valueMode = resolveValueMode(item);
  const displayUnit = resolveDisplayUnit(item);
  const chartData = sortAnalyticsPoints(item.data);
  const hasDataPoints = chartData.length >= 1;

  return (
    <div className="group relative">
      <div
        className={`
          flex flex-col h-full
          bg-newTableHeader
          border border-newTableBorder
          rounded-[12px]
          overflow-hidden
          transition-all duration-200
          hover:border-[#eb3825]/50
        `}
      >
        <div className="flex items-center justify-between px-[16px] pt-[14px] pb-[8px]">
          <div className="flex items-center gap-[10px]">
            <div
              className={`
                w-[8px] h-[8px] rounded-full
                ${color === 'purple' ? 'bg-[#eb3825]' : ''}
                ${color === 'green' ? 'bg-[#32d583]' : ''}
                ${color === 'blue' ? 'bg-[#1d9bf0]' : ''}
              `}
            />
            <span className="text-[15px] font-medium text-newTableText">
              {item.label}
            </span>
          </div>
          {item.percentageChange !== undefined && (
            <TrendIndicator
              value={item.percentageChange}
              valueMode={valueMode}
              displayUnit={displayUnit}
            />
          )}
        </div>

        {hasDataPoints ? (
          <>
            <div className="flex-1 px-[12px] py-[8px]">
              <div className="h-[120px] relative">
                <ChartSocial
                  data={chartData}
                  color={color}
                  valueMode={valueMode}
                  key={`chart-${index}`}
                />
              </div>
            </div>

            <div className="px-[16px] pb-[14px]">
              <div className="text-[36px] leading-[42px] font-semibold tracking-tight">
                {total}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-[32px] px-[16px]">
            <div className="text-[48px] leading-[56px] font-semibold tracking-tight">
              {total}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyState: FC = () => {
  const t = useT();

  return (
    <div className="col-span-full flex flex-col items-center justify-center py-[48px] px-[24px] bg-newTableHeader border border-newTableBorder rounded-[12px]">
      <div className="w-[48px] h-[48px] mb-[16px] rounded-full bg-[#eb3825]/10 flex items-center justify-center">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-[#eb3825]"
        >
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path d="M12 8v4l2 2" />
        </svg>
      </div>
      <p className="text-[15px] text-newTableText text-center">
        {t(
          'analytics_collecting_history',
          'Analytics history is still being collected. Metrics will appear after the first daily snapshots.'
        )}
      </p>
    </div>
  );
};

export const RenderAnalytics: FC<{
  integration: Integration;
  date: number;
}> = (props) => {
  const { integration, date } = props;
  const { data, isLoading } = usePlatformAnalytics(integration, date);

  const totals = useMemo(() => {
    return data?.map((item: AnalyticsDataItem) => analyticsTotal(item));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-[48px]">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[16px]">
      {data?.length === 0 && <EmptyState />}
      {data?.map((item: AnalyticsDataItem, index: number) => (
        <AnalyticsCard
          key={`analytics-${index}`}
          item={item}
          total={totals?.[index] ?? analyticsTotal(item)}
          index={index}
        />
      ))}
    </div>
  );
};
