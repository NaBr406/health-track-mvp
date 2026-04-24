import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { borders, colors, layout, radii, spacing, typography } from "../../../theme/tokens";
import type { GlucoseAxisItem, GlucoseChartMeta, GlucoseRiskTone } from "../model/dashboardScreenModel";

const GLUCOSE_SAFE_LINE = "#42A08A";
const GLUCOSE_SAFE_FILL = "rgba(66, 160, 138, 0.18)";
const GLUCOSE_WARNING_LINE = "#D4A227";
const GLUCOSE_WARNING_FILL = "rgba(212, 162, 39, 0.22)";
const GLUCOSE_DANGER_LINE = "#D96060";
const GLUCOSE_DANGER_FILL = "rgba(217, 96, 96, 0.24)";

type GlucoseLineChartProps = {
  chart: GlucoseChartMeta;
};

export function GlucoseLineChart({ chart }: GlucoseLineChartProps) {
  const { width: windowWidth } = useWindowDimensions();

  if (chart.kind === "empty") {
    return (
      <View style={styles.glucoseEmptyState}>
        <Ionicons color={colors.textSoft} name="pulse-outline" size={24} />
        <Text style={styles.glucoseEmptyTitle}>{chart.emptyLabel}</Text>
      </View>
    );
  }

  const width = Math.max(280, Math.min(windowWidth - layout.pageHorizontal * 2 - spacing.lg * 2, 420));
  const height = 194;
  const chartPaddingLeft = 10;
  const chartPaddingRight = 36;
  const chartPaddingTop = 12;
  const chartPaddingBottom = 34;
  const maxPointRadius = 5.6;
  const plotInsetX = maxPointRadius + 4;
  const plotInsetY = maxPointRadius + 4;
  const plotLeft = chartPaddingLeft + plotInsetX;
  const plotRight = width - chartPaddingRight - plotInsetX;
  const plotTop = chartPaddingTop + plotInsetY;
  const plotBottom = height - chartPaddingBottom - plotInsetY;
  const availableHeight = Math.max(plotBottom - plotTop, 1);
  const chartRange = Math.max(chart.maxValue - chart.minValue, 0.1);
  const availableWidth = Math.max(plotRight - plotLeft, 1);
  const xRange = Math.max(chart.xMax - chart.xMin, 1);
  const resolveY = (value: number) => plotTop + ((chart.maxValue - value) / chartRange) * availableHeight;
  const resolveX = (xValue: number) => plotLeft + ((xValue - chart.xMin) / xRange) * availableWidth;
  const baselineY = plotBottom;
  const axisItems = sampleXAxisItems(chart.xAxisItems, availableWidth);
  const segments = chart.points.slice(0, -1).map((point, index) => {
    const nextPoint = chart.points[index + 1];
    return {
      id: `${point.xValue}-${nextPoint.xValue}`,
      startPoint: point,
      endPoint: nextPoint,
      tone: resolveGlucoseTone(Math.max(point.value, nextPoint.value))
    };
  });

  return (
    <View style={styles.glucoseChartBlock}>
      <View style={styles.glucoseChartFrame}>
        <Svg height={height} style={styles.glucoseSvg} viewBox={`0 0 ${width} ${height}`} width="100%">
          {chart.yTicks.map((tick) => {
            const y = resolveY(tick);
            return <Line key={`y-grid-${tick}`} stroke="rgba(16, 35, 59, 0.08)" strokeWidth={1} x1={plotLeft} x2={plotRight} y1={y} y2={y} />;
          })}

          {axisItems.map((item) => {
            const x = resolveX(item.value);
            return <Line key={`x-grid-${item.value}`} stroke="rgba(16, 35, 59, 0.03)" strokeWidth={1} x1={x} x2={x} y1={plotTop} y2={plotBottom} />;
          })}

          {segments.map((segment) => {
            const colorsByTone = getGlucoseToneColors(segment.tone);
            return (
              <Path
                key={`area-${segment.id}`}
                d={`M ${resolveX(segment.startPoint.xValue)} ${resolveY(segment.startPoint.value)} L ${resolveX(segment.endPoint.xValue)} ${resolveY(segment.endPoint.value)} L ${resolveX(segment.endPoint.xValue)} ${baselineY} L ${resolveX(segment.startPoint.xValue)} ${baselineY} Z`}
                fill={colorsByTone.fill}
              />
            );
          })}

          {segments.map((segment) => {
            const colorsByTone = getGlucoseToneColors(segment.tone);
            return (
              <Path
                key={`line-${segment.id}`}
                d={`M ${resolveX(segment.startPoint.xValue)} ${resolveY(segment.startPoint.value)} L ${resolveX(segment.endPoint.xValue)} ${resolveY(segment.endPoint.value)}`}
                fill="none"
                stroke={colorsByTone.line}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3.5}
              />
            );
          })}

          {chart.points.map((point, index) => {
            const toneColors = getGlucoseToneColors(resolveGlucoseTone(point.value));
            const isCurrentMarker = point.pointType === "current_marker";

            return (
              <Circle
                key={`point-${index}`}
                cx={resolveX(point.xValue)}
                cy={resolveY(point.value)}
                fill={toneColors.line}
                opacity={isCurrentMarker ? 1 : 0.95}
                r={isCurrentMarker ? 5.6 : point.pointType === "measured_anchor" ? 4.8 : 4.2}
                stroke={isCurrentMarker ? colors.surface : "none"}
                strokeWidth={isCurrentMarker ? 2.2 : 0}
              />
            );
          })}
        </Svg>

        <View
          pointerEvents="none"
          style={[
            styles.glucoseYAxis,
            {
              top: Math.max(plotTop - 8, 0),
              bottom: Math.max(height - plotBottom - 8, 0)
            }
          ]}
        >
          {chart.yTicks.map((tick) => (
            <Text key={`tick-${tick}`} style={styles.glucoseYAxisLabel}>
              {formatGlucoseAxisLabel(tick)}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.glucoseAxisLabels}>
        {axisItems.map((item, index) => (
          <View
            key={`${item.label}-${item.value}`}
            style={[
              styles.glucoseAxisItem,
              { left: `${(resolveX(item.value) / width) * 100}%` },
              index === 0
                ? styles.glucoseAxisItemStart
                : index === axisItems.length - 1
                  ? styles.glucoseAxisItemEnd
                  : styles.glucoseAxisItemCenter
            ]}
          >
            <Text style={styles.glucoseAxisLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatGlucoseAxisLabel(value: number) {
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return `${Math.round(value)}`;
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

function sampleXAxisItems(items: GlucoseAxisItem[], availableWidth: number) {
  if (items.length <= 2) {
    return items;
  }

  const maxLabels = Math.max(2, Math.floor(availableWidth / 74));
  if (items.length <= maxLabels) {
    return items;
  }

  const step = Math.ceil((items.length - 1) / (maxLabels - 1));
  const selected = items.filter((_, index) => index === 0 || index === items.length - 1 || index % step === 0);

  if (selected[selected.length - 1]?.value !== items[items.length - 1]?.value) {
    selected.push(items[items.length - 1]);
  }

  return selected;
}

function resolveGlucoseTone(value: number): GlucoseRiskTone {
  if (value > 13) {
    return "danger";
  }
  if (value > 10) {
    return "warning";
  }
  return "safe";
}

function getGlucoseToneColors(tone: GlucoseRiskTone) {
  if (tone === "danger") {
    return {
      line: GLUCOSE_DANGER_LINE,
      fill: GLUCOSE_DANGER_FILL
    };
  }

  if (tone === "warning") {
    return {
      line: GLUCOSE_WARNING_LINE,
      fill: GLUCOSE_WARNING_FILL
    };
  }

  return {
    line: GLUCOSE_SAFE_LINE,
    fill: GLUCOSE_SAFE_FILL
  };
}

const styles = StyleSheet.create({
  glucoseChartBlock: {
    gap: spacing.xs
  },
  glucoseChartFrame: {
    position: "relative",
    borderRadius: radii.md,
    backgroundColor: "transparent",
    overflow: "hidden"
  },
  glucoseSvg: {
    width: "100%"
  },
  glucoseYAxis: {
    position: "absolute",
    top: 12,
    right: spacing.xs,
    bottom: 38,
    width: 24,
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  glucoseYAxisLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "500"
  },
  glucoseAxisLabels: {
    position: "relative",
    height: 46
  },
  glucoseAxisItem: {
    position: "absolute",
    top: 0,
    width: 68
  },
  glucoseAxisItemStart: {
    marginLeft: 0,
    alignItems: "flex-start"
  },
  glucoseAxisItemCenter: {
    marginLeft: -34,
    alignItems: "center"
  },
  glucoseAxisItemEnd: {
    marginLeft: -68,
    alignItems: "flex-end"
  },
  glucoseAxisLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    transform: [{ rotate: "-32deg" }]
  },
  glucoseEmptyState: {
    minHeight: 194,
    borderRadius: radii.md,
    borderWidth: borders.standard,
    borderColor: "rgba(16, 35, 59, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.56)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm
  },
  glucoseEmptyTitle: {
    color: colors.textSoft,
    fontSize: typography.bodyLarge,
    fontWeight: "700"
  }
});
