import React from 'react';
import { RadarScores } from '../../types/interview';

interface RadarChartSvgProps {
  scores: RadarScores;
  size?: number;
}

const AXES: Array<{ key: keyof RadarScores; label: string }> = [
  { key: 'Python', label: 'Python & AST' },
  { key: 'APIs', label: 'FastAPI & Gateways' },
  { key: 'Databases', label: 'DB & Indexing' },
  { key: 'System_Design', label: 'System Design' },
  { key: 'AI_Agents', label: 'LangGraph & RAG' },
];

export const RadarChartSvg: React.FC<RadarChartSvgProps> = ({ scores, size = 250 }) => {
  const center = size / 2;
  const radius = size * 0.34;
  const levels = [0.25, 0.5, 0.75, 1.0];

  const getCoordinates = (index: number, valuePct: number) => {
    const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
    const r = radius * (Math.max(0, Math.min(100, valuePct)) / 100);
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const dataPoints = AXES.map((axis, i) => {
    const val = Number(scores[axis.key] ?? 60);
    return { ...getCoordinates(i, val), val, label: axis.label };
  });

  const polygonPoints = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <defs>
          <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(99, 102, 241, 0.48)" />
            <stop offset="100%" stopColor="rgba(6, 182, 212, 0.18)" />
          </radialGradient>
        </defs>

        {/* Concentric Grid Polygons */}
        {levels.map((lvl) => {
          const pts = AXES.map((_, i) => {
            const c = getCoordinates(i, lvl * 100);
            return `${c.x.toFixed(1)},${c.y.toFixed(1)}`;
          }).join(' ');
          return (
            <polygon
              key={lvl}
              points={pts}
              fill="none"
              stroke="rgba(51, 65, 85, 0.65)"
              strokeWidth="1"
              strokeDasharray={lvl < 1 ? '2,2' : undefined}
            />
          );
        })}

        {/* Axis Spokes */}
        {AXES.map((_, i) => {
          const outer = getCoordinates(i, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="rgba(51, 65, 85, 0.7)"
              strokeWidth="1"
            />
          );
        })}

        {/* Candidate Competency Polygon */}
        <polygon
          points={polygonPoints}
          fill="url(#radarFillGrad)"
          stroke="#818cf8"
          strokeWidth="2.25"
        />

        {/* Data Vertices & Labels */}
        {dataPoints.map((pt, idx) => {
          const labelPos = getCoordinates(idx, 126);
          return (
            <g key={pt.label}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r="4"
                fill="#22d3ee"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              <text
                x={labelPos.x}
                y={labelPos.y - 4}
                textAnchor="middle"
                className="fill-slate-300 text-[10px] font-semibold"
              >
                {pt.label}
              </text>
              <text
                x={labelPos.x}
                y={labelPos.y + 8}
                textAnchor="middle"
                className="fill-indigo-400 text-[10px] font-mono font-bold"
              >
                {pt.val}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

