import React from 'react';
import type { RatingConfig } from '../../../types/feedback';

interface RatingHistogramProps {
  distribution: number[];
  mean: number | null;
  answered: number;
  config: RatingConfig | null;
  caption: string;
}

const RatingHistogram: React.FC<RatingHistogramProps> = ({
  distribution,
  mean,
  answered,
  config,
  caption,
}) => {
  const max = Math.max(...distribution, 1);

  return (
    <figure className="chart-rating">
      <div className="chart-rating__stat">
        <span className="chart-rating__mean">{mean === null ? '–' : mean.toFixed(1)}</span>
        <span className="chart-muted">average out of 5</span>
      </div>
      <div className="chart-rating__plot" aria-hidden="true">
        <div className="chart-rating__columns">
          {distribution.map((count, index) => (
            <div
              key={index}
              className="chart-rating__column"
              title={`${index + 1}: ${count} (${answered ? Math.round((count / answered) * 100) : 0}%)`}
            >
              <span className="chart-rating__value">{count}</span>
              <span
                className="chart-rating__bar"
                style={{ height: `${(count / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="chart-rating__axis">
          {distribution.map((_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        {(config?.minLabel || config?.maxLabel) && (
          <div className="feedback-rating__labels">
            <span>{config?.minLabel}</span>
            <span>{config?.maxLabel}</span>
          </div>
        )}
      </div>
      {/* A table ignores the 1px sr-only width, so the wrapper hides it */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Rating</th>
              <th scope="col">Answers</th>
            </tr>
          </thead>
          <tbody>
            {distribution.map((count, index) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
};

export default RatingHistogram;
