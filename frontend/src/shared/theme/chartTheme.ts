import { ThemeTokens } from "./themeMode"

// Nivo theme built from the Reservoir tokens: recessive grid and axes, ink-coloured text, AAA-contrast tick labels
export const createChartTheme = (tokens: ThemeTokens) => ({
  background: "transparent",
  text: {
    fill: tokens.ink,
    fontFamily: tokens.fontBody,
    fontSize: 13,
  },
  axis: {
    domain: { line: { stroke: tokens.line, strokeWidth: 1 } },
    ticks: {
      line: { stroke: tokens.line, strokeWidth: 1 },
      text: { fill: tokens.inkMuted, fontSize: 13, fontFamily: tokens.fontBody },
    },
    legend: { text: { fill: tokens.inkMuted, fontSize: 13, fontFamily: tokens.fontBody } },
  },
  grid: { line: { stroke: tokens.lineSoft, strokeWidth: 1 } },
  crosshair: { line: { stroke: tokens.ink, strokeWidth: 1, strokeOpacity: 0.6 } },
  tooltip: {
    container: {
      background: tokens.basin,
      color: tokens.ink,
      fontFamily: tokens.fontBody,
      fontSize: 14,
      borderRadius: 10,
      border: `1px solid ${tokens.lineSoft}`,
      boxShadow: "none",
    },
  },
})
