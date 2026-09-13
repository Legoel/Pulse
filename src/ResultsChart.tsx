import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { HostSession } from "./types";

const palette = [
  "#ed5b3a",
  "#087f73",
  "#e8a52b",
  "#4b62a8",
  "#be4774",
  "#5d8244",
  "#805ca4",
  "#53727f",
];

export default function ResultsChart({ state }: { state: HostSession }) {
  const showCorrectAnswers = state.phase === "results";
  const data =
    state.question?.options.map((option, index) => ({
      name: `${showCorrectAnswers && state.results?.find((result) => result.optionId === option.id)?.isCorrect ? "✓ " : ""}${String.fromCharCode(65 + index)}. ${option.text}`,
      votes:
        state.results?.find((result) => result.optionId === option.id)?.count ??
        0,
      isCorrect:
        showCorrectAnswers &&
        (state.results?.find((result) => result.optionId === option.id)
          ?.isCorrect ??
          false),
      color: palette[index % palette.length],
    })) ?? [];
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 35 }}>
          <CartesianGrid horizontal={false} stroke="#dedbd2" />
          <XAxis
            type="number"
            allowDecimals={false}
            domain={[0, Math.max(1, state.participantCount)]}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={180}
            tick={{ fill: "#252722", fontSize: 13 }}
          />
          <Bar
            dataKey="votes"
            radius={[0, 5, 5, 0]}
            label={{ position: "right", fill: "#252722", fontWeight: 800 }}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.isCorrect ? "#087f73" : entry.color}
                opacity={showCorrectAnswers && !entry.isCorrect ? 0.35 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
