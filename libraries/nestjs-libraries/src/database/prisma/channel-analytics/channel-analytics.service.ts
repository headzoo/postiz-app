import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelAnalyticsValueMode as PrismaValueMode } from '@prisma/client';
import {
  AnalyticsData,
  ChannelAnalyticsCapturePage,
  ChannelAnalyticsDatedPoint,
  ChannelAnalyticsDisplayUnit,
  ChannelAnalyticsPostLifetimePoint,
  ChannelAnalyticsValueMode,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import {
  AnalyticsDailyPointInput,
  AnalyticsPostMetricInput,
  ChannelAnalyticsRepository,
} from './channel-analytics.repository';

const WINDOW_DAYS = new Set([7, 30, 90]);
const MAX_PAGE_POINTS = 1_000;
const MAX_TEXT_LENGTH = 256;

@Injectable()
export class ChannelAnalyticsService {
  constructor(private _repository: ChannelAnalyticsRepository) {}

  persistCapturePage(
    organizationId: string,
    integrationId: string,
    snapshotAt: Date,
    page: ChannelAnalyticsCapturePage
  ) {
    this.validateSnapshotAt(snapshotAt);
    if (
      !page ||
      !Array.isArray(page.points) ||
      page.points.length > MAX_PAGE_POINTS
    ) {
      throw new BadRequestException(
        `Analytics page may contain at most ${MAX_PAGE_POINTS} points`
      );
    }
    if (page.kind === 'daily') {
      const coverage = this.validateCoverage(page.coverage);
      return this._repository.persistDailyPage(
        organizationId,
        integrationId,
        snapshotAt,
        page.points.map((point) => this.validateDailyPoint(point)),
        coverage
      );
    }
    if (page.kind === 'post_lifetime') {
      return this._repository.persistPostLifetimePage(
        organizationId,
        integrationId,
        snapshotAt,
        page.points.map((point) => this.validatePostMetric(point))
      );
    }
    throw new BadRequestException('Unsupported analytics capture page');
  }

  finalizeCapture(
    organizationId: string,
    integrationId: string,
    snapshotAt: Date,
    kind: ChannelAnalyticsCapturePage['kind'],
    coveredDay?: Date
  ) {
    this.validateSnapshotAt(snapshotAt);
    if (coveredDay) this.validateUtcDay(coveredDay, 'coveredDay');
    return kind === 'daily'
      ? this._repository.finalizeDailyCapture(
          organizationId,
          integrationId,
          snapshotAt,
          coveredDay
        )
      : this._repository.finalizePostLifetimeCapture(
          organizationId,
          integrationId,
          snapshotAt
        );
  }

  recordFailure(
    organizationId: string,
    integrationId: string,
    category: string,
    message: string,
    attemptedAt = new Date()
  ) {
    this.validateText(category, 'category', 64);
    this.validateText(message, 'message', MAX_TEXT_LENGTH);
    this.validateSnapshotAt(attemptedAt);
    return this._repository.recordFailure(
      organizationId,
      integrationId,
      category,
      message,
      attemptedAt
    );
  }

  async getStoredAnalytics(
    organizationId: string,
    integrationId: string,
    days: 7 | 30 | 90,
    now = new Date()
  ): Promise<AnalyticsData[]> {
    if (!WINDOW_DAYS.has(days)) {
      throw new BadRequestException('Unsupported analytics window');
    }
    const integration = await this._repository.findOwnedIntegration(
      organizationId,
      integrationId
    );
    if (!integration) {
      throw new NotFoundException('Invalid integration');
    }
    if (integration.type !== 'social') {
      return [];
    }
    const window = await this.getWindow(
      organizationId,
      integrationId,
      days,
      now
    );
    return window.metrics.map((metric) => this.formatStoredMetric(metric));
  }

  isChannelUnavailable(
    syncState?: {
      failureCount: number;
      lastSuccessfulSnapshotAt: Date | null;
    } | null
  ) {
    return !!syncState?.failureCount && !syncState?.lastSuccessfulSnapshotAt;
  }

  async getWindow(
    organizationId: string,
    integrationId: string,
    days: 7 | 30 | 90,
    now = new Date()
  ) {
    if (!WINDOW_DAYS.has(days))
      throw new BadRequestException('Unsupported analytics window');
    this.validateSnapshotAt(now);
    const currentEnd = utcDay(now);
    currentEnd.setUTCDate(currentEnd.getUTCDate() + 1);
    const currentStart = new Date(currentEnd);
    currentStart.setUTCDate(currentStart.getUTCDate() - days);
    const previousStart = new Date(currentStart);
    previousStart.setUTCDate(previousStart.getUTCDate() - days);
    const [rows, syncState] = await Promise.all([
      this._repository.getDailyPoints(
        organizationId,
        integrationId,
        previousStart,
        currentEnd
      ),
      this._repository.getSyncState(organizationId, integrationId),
    ]);
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      grouped.set(row.metricKey, [...(grouped.get(row.metricKey) || []), row]);
    }
    return {
      from: currentStart,
      to: currentEnd,
      metrics: [...grouped.entries()].flatMap(([metricKey, points]) => {
        const valueMode = mapValueMode(points[0].valueMode);
        const currentObservations = points.filter(
          (point) => point.day >= currentStart
        );
        const previousObservations = points.filter(
          (point) => point.day < currentStart
        );
        if (
          (valueMode === 'average' || valueMode === 'latest') &&
          currentObservations.length === 0
        ) {
          return [];
        }
        const previousWindowCovered = isCoverageComplete(
          syncState,
          previousStart,
          currentStart
        );
        const currentWindowCovered = isCoverageComplete(
          syncState,
          currentStart,
          currentEnd
        );
        const current = this.fillCoveredSumDays(
          currentObservations,
          currentStart,
          currentEnd,
          valueMode,
          currentWindowCovered,
          points[0]
        );
        const previous = this.fillCoveredSumDays(
          previousObservations,
          previousStart,
          currentStart,
          valueMode,
          previousWindowCovered,
          points[0]
        );
        const currentForAggregate =
          valueMode === 'sum' ? current : currentObservations;
        const previousForAggregate =
          valueMode === 'sum' ? previous : previousObservations;
        const currentTotal = aggregate(currentForAggregate, valueMode);
        const previousTotal = aggregate(previousForAggregate, valueMode);
        const hasObservationsForTrend =
          valueMode === 'sum' ||
          (currentObservations.length > 0 && previousObservations.length > 0);
        const trend =
          !previousWindowCovered ||
          !currentWindowCovered ||
          !hasObservationsForTrend
            ? null
            : valueMode === 'average'
              ? currentTotal - previousTotal
              : previousTotal !== 0
                ? ((currentTotal - previousTotal) / Math.abs(previousTotal)) *
                  100
                : null;
        const responsePoints =
          valueMode === 'sum' ? current : currentObservations;
        return [
          {
            metricKey,
            label: points[0].label,
            valueMode,
            displayUnit: resolveDisplayUnit(valueMode, points[0].displayUnit),
            points: responsePoints.map((point) => ({
              day: point.day,
              value: point.value.toNumber(),
            })),
            total: currentTotal,
            trend,
          },
        ];
      }),
    };
  }

  private formatStoredMetric(metric: {
    label: string;
    valueMode: ChannelAnalyticsValueMode;
    displayUnit: ChannelAnalyticsDisplayUnit;
    points: Array<{ day: Date; value: number }>;
    trend: number | null;
  }): AnalyticsData {
    const data = metric.points.map((point) => ({
      date: point.day.toISOString().slice(0, 10),
      total: point.value,
    }));
    const response: AnalyticsData = {
      label: metric.label,
      valueMode: metric.valueMode,
      displayUnit: metric.displayUnit,
      data,
    };
    if (metric.valueMode === 'average' && metric.displayUnit === 'percentage') {
      response.average = true;
    }
    if (metric.trend !== null) {
      response.percentageChange = metric.trend;
    }
    return response;
  }

  private validateDailyPoint(
    point: ChannelAnalyticsDatedPoint
  ): AnalyticsDailyPointInput {
    return {
      ...this.validateMetric(point),
      day: this.parseUtcDay(point.day, 'day'),
    };
  }

  private validatePostMetric(
    point: ChannelAnalyticsPostLifetimePoint
  ): AnalyticsPostMetricInput {
    this.validateText(point?.externalPostId, 'externalPostId', MAX_TEXT_LENGTH);
    return {
      ...this.validateMetric(point),
      externalPostId: point.externalPostId,
    };
  }

  private validateMetric(point: {
    metricKey: string;
    label: string;
    valueMode: ChannelAnalyticsValueMode;
    displayUnit?: ChannelAnalyticsDisplayUnit;
    value: number;
  }) {
    this.validateText(point?.metricKey, 'metricKey', MAX_TEXT_LENGTH);
    this.validateText(point?.label, 'label', MAX_TEXT_LENGTH);
    if (!['sum', 'average', 'latest'].includes(point?.valueMode)) {
      throw new BadRequestException('Unsupported analytics value mode');
    }
    if (
      point?.displayUnit &&
      !['count', 'percentage', 'duration', 'decimal'].includes(point.displayUnit)
    ) {
      throw new BadRequestException('Unsupported analytics display unit');
    }
    if (!Number.isFinite(point?.value)) {
      throw new BadRequestException('Analytics metric value must be finite');
    }
    return {
      metricKey: point.metricKey,
      label: point.label,
      valueMode: prismaValueMode(point.valueMode),
      displayUnit: point.displayUnit
        ? prismaDisplayUnit(point.displayUnit)
        : null,
      value: point.value,
    };
  }

  private validateSnapshotAt(value: Date) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new BadRequestException('snapshotAt must be a valid timestamp');
    }
  }

  private validateUtcDay(value: Date, name: string) {
    this.validateSnapshotAt(value);
    if (
      value.getUTCHours() !== 0 ||
      value.getUTCMinutes() !== 0 ||
      value.getUTCSeconds() !== 0 ||
      value.getUTCMilliseconds() !== 0
    )
      throw new BadRequestException(`${name} must be a UTC calendar day`);
  }

  private validateCoverage(coverage: { fromDay: string; toDay: string }) {
    if (!coverage || typeof coverage !== 'object') {
      throw new BadRequestException('Daily analytics coverage is required');
    }
    const fromDay = this.parseUtcDay(coverage.fromDay, 'coverage.fromDay');
    const toDay = this.parseUtcDay(coverage.toDay, 'coverage.toDay');
    if (fromDay > toDay) {
      throw new BadRequestException(
        'Daily analytics coverage must have an ordered UTC interval'
      );
    }
    return { fromDay, toDay };
  }

  private fillCoveredSumDays<
    T extends { day: Date; value: { toNumber(): number } }
  >(
    points: T[],
    from: Date,
    to: Date,
    valueMode: ChannelAnalyticsValueMode,
    covered: boolean,
    template: T
  ) {
    if (valueMode !== 'sum' || !covered) return points;
    const byDay = new Map(points.map((point) => [point.day.toISOString(), point]));
    const filled: T[] = [];
    for (let day = new Date(from); day < to; day.setUTCDate(day.getUTCDate() + 1)) {
      const point = byDay.get(day.toISOString());
      filled.push(
        point ||
          ({
            ...template,
            day: new Date(day),
            value: { toNumber: () => 0 },
          } as T)
      );
    }
    return filled;
  }

  private parseUtcDay(value: string, name: string) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${name} must be an ISO UTC calendar day`);
    }
    const day = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(day.getTime()) ||
      day.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(`${name} must be an ISO UTC calendar day`);
    }
    return day;
  }

  private validateText(
    value: unknown,
    name: string,
    max: number
  ): asserts value is string {
    if (typeof value !== 'string' || !value || value.length > max) {
      throw new BadRequestException(
        `${name} must be between 1 and ${max} characters`
      );
    }
  }
}

const prismaValueMode = (value: ChannelAnalyticsValueMode) =>
  ({
    sum: PrismaValueMode.SUM,
    average: PrismaValueMode.AVERAGE,
    latest: PrismaValueMode.LATEST,
  }[value]);

const prismaDisplayUnit = (value: ChannelAnalyticsDisplayUnit) =>
  ({
    count: 'COUNT',
    percentage: 'PERCENTAGE',
    duration: 'DURATION',
    decimal: 'DECIMAL',
  }[value] as 'COUNT' | 'PERCENTAGE' | 'DURATION' | 'DECIMAL');

const mapDisplayUnit = (
  value: string | null | undefined
): ChannelAnalyticsDisplayUnit | undefined => {
  if (!value) return undefined;
  return (
    {
      COUNT: 'count',
      PERCENTAGE: 'percentage',
      DURATION: 'duration',
      DECIMAL: 'decimal',
    } as Record<string, ChannelAnalyticsDisplayUnit>
  )[value];
};

const resolveDisplayUnit = (
  valueMode: ChannelAnalyticsValueMode,
  displayUnit?: string | null
): ChannelAnalyticsDisplayUnit => {
  const mapped = mapDisplayUnit(displayUnit);
  if (mapped) return mapped;
  if (valueMode === 'average') return 'percentage';
  return 'count';
};

const mapValueMode = (value: PrismaValueMode): ChannelAnalyticsValueMode =>
  ({
    [PrismaValueMode.SUM]: 'sum',
    [PrismaValueMode.AVERAGE]: 'average',
    [PrismaValueMode.LATEST]: 'latest',
  }[value] as ChannelAnalyticsValueMode);

const aggregate = (
  points: Array<{ value: { toNumber(): number }; day: Date }>,
  mode: ChannelAnalyticsValueMode
) => {
  if (!points.length) return 0;
  if (mode === 'latest') return points[points.length - 1].value.toNumber();
  const total = points.reduce((sum, point) => sum + point.value.toNumber(), 0);
  return mode === 'average' ? total / points.length : total;
};

const utcDay = (value: Date) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );

const isCoverageComplete = (
  state:
    | {
        coverageStartDay?: Date | null;
        coverageEndDay?: Date | null;
      }
    | null
    | undefined,
  from: Date,
  to: Date
) => {
  if (!state?.coverageStartDay || !state.coverageEndDay) return false;
  const lastDay = new Date(to);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  return (
    state.coverageStartDay <= from &&
    state.coverageEndDay >= lastDay
  );
};
