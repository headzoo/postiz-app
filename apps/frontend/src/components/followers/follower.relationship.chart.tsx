'use client';

import { FC, useEffect, useRef } from 'react';
import DrawChart from 'chart.js/auto';
import { newDayjs } from '@gitroom/frontend/components/layout/set.timezone';
import { FollowerRelationshipSnapshot } from '@gitroom/frontend/components/followers/use.followers';

const formatReciprocity = (value: number | null) => {
  if (value == null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
};

const formatGradeLabel = (grade: number | null) => {
  if (grade == null) {
    return 'No grade (not enough tracked activity)';
  }
  return String(grade);
};

export const FollowerRelationshipChart: FC<{
  history: FollowerRelationshipSnapshot[];
}> = ({ history }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const chart = useRef<DrawChart | null>(null);

  useEffect(() => {
    if (!ref.current || !history.length) {
      return;
    }

    const labels = history.map((snapshot) =>
      newDayjs(snapshot.snapshotAt).format('MMM D, YYYY')
    );
    const grades = history.map(
      (snapshot) => snapshot.adjustedGrade ?? snapshot.grade
    );

    chart.current = new DrawChart(ref.current, {
      type: 'line',
      options: {
        maintainAspectRatio: false,
        responsive: true,
        spanGaps: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        scales: {
          y: {
            min: 1,
            max: 5,
            ticks: {
              stepSize: 0.5,
            },
            title: {
              display: true,
              text: 'Grade',
            },
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 0,
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const snapshot = history[context.dataIndex];
                if (!snapshot) {
                  return '';
                }
                const displayedGrade =
                  snapshot.adjustedGrade ?? snapshot.grade;
                const gradeLabel =
                  displayedGrade == null
                    ? 'No grade (not enough tracked activity)'
                    : `Grade: ${displayedGrade}`;
                return [
                  gradeLabel,
                  `E: ${snapshot.effortScore}`,
                  `R: ${snapshot.reciprocationScore}`,
                  `Reciprocity: ${formatReciprocity(snapshot.reciprocity)}`,
                ];
              },
            },
          },
        },
      },
      data: {
        labels,
        datasets: [
          {
            label: 'Relationship grade',
            data: grades,
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            pointBackgroundColor: '#8b5cf6',
            pointRadius: 4,
            tension: 0.2,
            fill: false,
          },
        ],
      },
    });

    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
  }, [history]);

  if (!history.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="h-[220px] w-full" aria-hidden="true">
        <canvas ref={ref} className="h-full w-full" />
      </div>
      <table
        className="w-full border-collapse text-[13px] text-textItemBlur"
        aria-label="Grade history"
      >
        <thead>
          <tr className="border-b border-newTableBorder text-left text-[12px] uppercase tracking-wide text-newTextColor">
            <th scope="col" className="py-[8px] pe-[12px] font-[600]">
              Date
            </th>
            <th scope="col" className="py-[8px] pe-[12px] font-[600]">
              Grade
            </th>
            <th scope="col" className="py-[8px] pe-[12px] font-[600]">
              E
            </th>
            <th scope="col" className="py-[8px] pe-[12px] font-[600]">
              R
            </th>
            <th scope="col" className="py-[8px] font-[600]">
              Reciprocity
            </th>
          </tr>
        </thead>
        <tbody>
          {history.map((snapshot) => (
            <tr
              key={snapshot.snapshotAt}
              className="border-b border-newTableBorder/60"
            >
              <td className="py-[8px] pe-[12px] text-newTextColor">
                {newDayjs(snapshot.snapshotAt).format('MMM D, YYYY')}
              </td>
              <td className="py-[8px] pe-[12px]">
                {formatGradeLabel(snapshot.adjustedGrade ?? snapshot.grade)}
              </td>
              <td className="py-[8px] pe-[12px]">{snapshot.effortScore}</td>
              <td className="py-[8px] pe-[12px]">
                {snapshot.reciprocationScore}
              </td>
              <td className="py-[8px]">
                {formatReciprocity(snapshot.reciprocity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
