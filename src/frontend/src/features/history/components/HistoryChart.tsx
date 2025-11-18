import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AttemptRecord } from "../../../types/attempts";

function formatDayOnly(timestamp?: number) {
  if (!timestamp || Number.isNaN(timestamp)) return "";
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return String(date.getDate());
}

function formatFull(timestamp?: number) {
  if (!timestamp || Number.isNaN(timestamp)) return "Unknown";
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Props = {
  attempts?: AttemptRecord[];
};

const CHART_MARGIN = {
  top: 24,
  right: 24,
  bottom: 48,
  left: 56,
} as const;
const CHART_HEIGHT = 260;
const TOOLTIP_WIDTH = 160;
const TOOLTIP_HEIGHT = 74;

function prettifyType(type?: string) {
  if (!type) return "Unknown type";
  switch (type) {
    case "diagnostic":
      return "Diagnostic";
    case "practice":
      return "Practice";
    case "mini_quiz":
      return "Mini quiz";
    case "unit_test":
      return "Unit test";
    default:
      return type.replace(/_/g, " ");
  }
}

type RangeValue = "all" | "30" | "7";

export default function HistoryChart({ attempts = [] }: Props) {
  const safeAttempts = Array.isArray(attempts) ? attempts : [];
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [range, setRange] = useState<RangeValue>("all");
  const [width, setWidth] = useState(720);
  const chartRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (!chartRef.current) return;
      setWidth(Math.max(320, chartRef.current.clientWidth));
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredAttempts = useMemo(() => {
    const valid = safeAttempts.filter(
      (attempt) =>
        attempt &&
        typeof attempt.createdAt === "number" &&
        !Number.isNaN(attempt.createdAt)
    );
    if (range === "all") return valid;
    const days = range === "30" ? 30 : 7;
    const cutoff = Date.now() / 1000 - days * 24 * 60 * 60;
    return valid.filter((attempt) => (attempt.createdAt || 0) >= cutoff);
  }, [safeAttempts, range]);

  useEffect(() => {
    if (!chartRef.current) return;
    setWidth(Math.max(320, chartRef.current.clientWidth));
  }, [filteredAttempts.length]);

  const points = useMemo(() => {
    const dataset = filteredAttempts;
    if (!dataset.length) return [];
    const sorted = [...dataset].sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
    );
    const height = CHART_HEIGHT;
    const margin = CHART_MARGIN;
    const innerWidth = Math.max(1, width - margin.left - margin.right);
    const innerHeight = Math.max(1, height - margin.top - margin.bottom);
    const step =
      sorted.length > 1 ? innerWidth / (sorted.length - 1) : innerWidth / 2;
    return sorted
      .map((attempt, index) => {
        const pct = Math.max(0, Math.min(100, attempt.scorePct ?? 0));
        const x =
          margin.left + (sorted.length > 1 ? index * step : innerWidth / 2);
        const y = margin.top + innerHeight * (1 - pct / 100);
        return {
          x,
          y,
          pct,
          date: attempt.createdAt,
          quizType: attempt.quizType,
        };
      })
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  }, [filteredAttempts, width]);

  const height = CHART_HEIGHT;
  const margin = CHART_MARGIN;
  const yTicks = [0, 25, 50, 75, 100];
  const isRangeEmpty = points.length === 0;
  const tooltipPoint =
    hoverIndex != null && points[hoverIndex] ? points[hoverIndex] : null;
  const tooltipPosition = tooltipPoint
    ? {
        x: Math.min(
          Math.max(tooltipPoint.x - TOOLTIP_WIDTH / 2, margin.left),
          width - margin.right - TOOLTIP_WIDTH
        ),
        y: Math.min(
          Math.max(tooltipPoint.y - TOOLTIP_HEIGHT - 12, margin.top),
          height - margin.bottom - TOOLTIP_HEIGHT
        ),
      }
    : null;

  return (
    <div className="history-chart-wrapper">
      <div className="history-range">
        {[
          { id: "all", label: "All time" },
          { id: "30", label: "Last 30 days" },
          { id: "7", label: "Last 7 days" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            className={`range-btn ${range === option.id ? "active" : ""}`}
            onClick={() => setRange(option.id as RangeValue)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {isRangeEmpty ? (
        <div className="history-chart empty">
          <p className="muted small">No attempts in this range yet.</p>
        </div>
      ) : (
        <div
          className="history-chart"
          ref={chartRef}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <svg viewBox={`0 0 ${width} ${height}`}>
        {/* gridlines */}
        {yTicks.map((tick) => {
          const y =
            margin.top +
            (height - margin.top - margin.bottom) * (1 - tick / 100);
          return (
            <g key={tick}>
              <line
                x1={margin.left}
                y1={y}
                x2={width - margin.right}
                y2={y}
                className="chart-gridline"
              />
              <text
                x={margin.left - 12}
                y={y + 4}
                className="chart-axis-label"
              >
                {tick}%
              </text>
            </g>
          );
        })}
        {/* axes */}
        <line
          x1={margin.left}
          y1={height - margin.bottom}
          x2={width - margin.right}
          y2={height - margin.bottom}
          className="chart-axis"
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={height - margin.bottom}
          className="chart-axis"
        />
        {/* spark line */}
        <path
          d={points
            .map((point, idx) =>
              `${idx === 0 ? "M" : "L"}${point.x},${point.y}`
            )
            .join(" ")}
          fill="none"
          stroke="#2563eb"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {points.map((point, idx) => (
          <g key={idx}>
            <circle
              cx={point.x}
              cy={point.y}
              r={6}
              fill="#fff"
              stroke="#2563eb"
              strokeWidth={2}
              onMouseEnter={() => setHoverIndex(idx)}
            />
            <text
              x={point.x}
              y={height - margin.bottom + 18}
              className="chart-axis-label"
              textAnchor="middle"
            >
              {formatDayOnly(point.date)}
            </text>
            <line
              x1={point.x}
              y1={height - margin.bottom}
              x2={point.x}
              y2={height - margin.bottom + 6}
              className="chart-axis"
            />
          </g>
        ))}
        <text
          x={width / 2}
          y={height - 8}
          className="chart-axis-label"
          textAnchor="middle"
        >
          Date
        </text>
        <text
          x={-height / 2}
          y={16}
          transform="rotate(-90)"
          className="chart-axis-label"
          textAnchor="middle"
        >
          Score (%)
        </text>
        {tooltipPoint && tooltipPosition && (
          <foreignObject
            x={tooltipPosition.x}
            y={tooltipPosition.y}
            width={TOOLTIP_WIDTH}
            height={TOOLTIP_HEIGHT}
            pointerEvents="none"
          >
            <div className="chart-tooltip">
              <strong>{tooltipPoint.pct}%</strong>
              <span>{formatFull(tooltipPoint.date)}</span>
              <span className="muted small">
                {prettifyType(tooltipPoint.quizType)}
              </span>
            </div>
          </foreignObject>
        )}
      </svg>
        </div>
      )}
    </div>
  );
}
