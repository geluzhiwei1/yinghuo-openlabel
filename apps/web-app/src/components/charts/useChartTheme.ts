/**
 * Chart palette reader — reads `--y-chart-*` tokens from the DOM at call time.
 *
 * Why runtime CSS var lookup instead of TS constants:
 *  - Single source of truth (token SCSS)
 *  - Dark mode + three-face differentiation work automatically
 *  - Future palette tweaks only need a token change
 *
 * Trade-off: charts re-render on theme toggle only when their host component
 * re-runs setOption. Call readChartTheme() inside setOption each render, not
 * once at module load.
 */
const read = (name: string): string => {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return v || ''
}

export interface ChartTheme {
  primary: string
  success: string
  warning: string
  danger: string
  info: string
  neutral: string
  categorical: string[]
  heat: {
    low: string
    mid: string
    high: string
    warn: string
    success: string
  }
  axisLine: string
  axisLabel: string
  tooltipBg: string
  tooltipBorder: string
}

export function readChartTheme(): ChartTheme {
  const cat = [
    read('--y-chart-cat-1'),
    read('--y-chart-cat-2'),
    read('--y-chart-cat-3'),
    read('--y-chart-cat-4'),
    read('--y-chart-cat-5'),
    read('--y-chart-cat-6'),
    read('--y-chart-cat-7'),
  ].filter(Boolean)
  return {
    primary:   read('--y-chart-primary'),
    success:   read('--y-chart-success'),
    warning:   read('--y-chart-warning'),
    danger:    read('--y-chart-danger'),
    info:      read('--y-chart-info'),
    neutral:   read('--y-chart-neutral'),
    categorical: cat,
    heat: {
      low:     read('--y-chart-heat-low'),
      mid:     read('--y-chart-heat-mid'),
      high:    read('--y-chart-heat-high'),
      warn:    read('--y-chart-heat-warn'),
      success: read('--y-chart-heat-success'),
    },
    axisLine:     read('--y-chart-axis-line'),
    axisLabel:    read('--y-chart-axis-label'),
    tooltipBg:    read('--y-chart-tooltip-bg'),
    tooltipBorder: read('--y-chart-tooltip-border'),
  }
}

/** Plotly colorscale: array of [stop, color] tuples from low → high. */
export function heatScale(
  stops: { low: string; mid: string; high: string },
): Array<[number, string]> {
  return [
    [0, stops.low],
    [0.3, stops.mid],
    [1, stops.high],
  ]
}
