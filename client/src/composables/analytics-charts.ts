import { use } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { formatMoney } from './format.ts';
import 'vue-echarts/style.css';

use([
  CanvasRenderer,
  PieChart,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent
]);

const TEXT = '#172b4d';
const MUTED = '#5e6c84';
const BLUE = '#0079bf';
const GREEN = '#61bd4f';
const BORDER = '#dfe1e6';
const SPLIT = '#ebecf0';

const STATUS_COLORS = [
  '#0079bf',
  '#61bd4f',
  '#ff9f1a',
  '#eb5a46',
  '#c377e0',
  '#00c2e0',
  '#51e898',
  '#ff78cb',
  '#344563'
];

interface ChartTooltipItem {
  axisValue?: string;
  seriesName?: string;
  value?: number | string;
  marker?: string;
  name?: string;
  percent?: number;
  data?: unknown;
}

interface WorkloadBarDatum {
  value: number;
  amount?: number;
}

function tooltipItems(raw: unknown): ChartTooltipItem[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is ChartTooltipItem =>
        typeof item === 'object' && item !== null
    );
  }

  if (typeof raw === 'object' && raw !== null) {
    return [raw as ChartTooltipItem];
  }

  return [];
}

function numericValue(value: number | string | undefined): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function weekLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short'
  });
}

function axisValue(): Record<string, unknown> {
  return {
    type: 'value',
    axisLabel: { color: MUTED, fontSize: 11 },
    axisLine: { show: false },
    splitLine: { lineStyle: { color: SPLIT } }
  };
}

export function statusPieOption(
  rows: { columnId: string; name: string; count: number }[]
): EChartsOption {
  const slices = rows.filter((row) => row.count > 0);

  return {
    color: STATUS_COLORS,
    tooltip: {
      trigger: 'item',
      formatter: (raw: unknown) => {
        const item = tooltipItems(raw)[0];

        if (!item) {
          return '';
        }

        const percent = item.percent ?? 0;
        return `${item.name ?? ''}: ${numericValue(item.value)} (${percent}%)`;
      }
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: MUTED, fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        radius: ['48%', '70%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        cursor: 'pointer',
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2
        },
        label: { show: false },
        data: slices.map((row) => ({
          name: row.name,
          value: row.count,
          columnId: row.columnId
        }))
      }
    ]
  };
}

export function weeksLineOption(
  weeks: { from: string; hours: number; amount?: number }[],
  showMoney: boolean
): EChartsOption {
  const labels = weeks.map((week) => weekLabel(week.from));
  const hours = weeks.map((week) => week.hours);
  const amounts = weeks.map((week) => week.amount ?? 0);

  return {
    color: [BLUE, GREEN],
    tooltip: {
      trigger: 'axis',
      formatter: (raw: unknown) => {
        const items = tooltipItems(raw);
        const title = items[0]?.axisValue ?? '';
        const lines = items.map((item) => {
          const value = numericValue(item.value);
          const formatted =
            item.seriesName === 'Сумма'
              ? formatMoney(value)
              : `${value.toLocaleString('ru-RU')} ч`;

          return `${item.marker ?? ''}${item.seriesName ?? ''}: ${formatted}`;
        });

        return [title, ...lines].join('<br/>');
      }
    },
    legend: showMoney
      ? {
          top: 0,
          icon: 'circle',
          itemWidth: 8,
          itemHeight: 8,
          textStyle: { color: MUTED, fontSize: 12 }
        }
      : undefined,
    grid: {
      left: 48,
      right: showMoney ? 56 : 16,
      top: showMoney ? 36 : 16,
      bottom: 28
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: MUTED, fontSize: 11 },
      axisLine: { lineStyle: { color: BORDER } },
      axisTick: { show: false }
    },
    yAxis: showMoney
      ? [
          {
            ...axisValue(),
            name: 'ч',
            nameTextStyle: { color: MUTED, fontSize: 11 }
          },
          {
            ...axisValue(),
            name: '₽',
            nameTextStyle: { color: MUTED, fontSize: 11 },
            splitLine: { show: false }
          }
        ]
      : [
          {
            ...axisValue(),
            name: 'ч',
            nameTextStyle: { color: MUTED, fontSize: 11 }
          }
        ],
    series: [
      {
        name: 'Часы',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: hours,
        areaStyle: { opacity: 0.12 }
      },
      ...(showMoney
        ? [
            {
              name: 'Сумма',
              type: 'line' as const,
              yAxisIndex: 1,
              smooth: true,
              symbol: 'circle',
              symbolSize: 6,
              data: amounts
            }
          ]
        : [])
    ]
  };
}

export function workloadBarOption(
  rows: { displayName: string; hours: number; amount?: number }[]
): EChartsOption {
  const names = rows.map((row) => row.displayName);
  const data: WorkloadBarDatum[] = rows.map((row) => ({
    value: row.hours,
    amount: row.amount
  }));

  return {
    color: [BLUE],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const item = tooltipItems(raw)[0];

        if (!item) {
          return '';
        }

        const hours = numericValue(item.value);
        const extra =
          typeof item.data === 'object' &&
          item.data !== null &&
          'amount' in item.data &&
          typeof item.data.amount === 'number'
            ? `<br/>${formatMoney(item.data.amount)}`
            : '';

        return `${item.name ?? ''}<br/>${hours.toLocaleString('ru-RU')} ч${extra}`;
      }
    },
    grid: {
      left: 120,
      right: 56,
      top: 8,
      bottom: 8
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: MUTED, fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: SPLIT } }
    },
    yAxis: {
      type: 'category',
      data: names,
      axisLabel: {
        color: TEXT,
        fontSize: 12,
        width: 108,
        overflow: 'truncate'
      },
      axisLine: { show: false },
      axisTick: { show: false }
    },
    series: [
      {
        type: 'bar',
        data,
        barMaxWidth: 18,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: MUTED,
          fontSize: 11,
          formatter: (raw: unknown) => {
            const item = raw as ChartTooltipItem;
            return `${numericValue(item.value)} ч`;
          }
        }
      }
    ]
  };
}

export function workloadChartHeight(count: number): number {
  return Math.max(200, count * 36 + 16);
}
