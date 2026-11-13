import React from 'react';
import BarList from './charts/BarList';
import RatingHistogram from './charts/RatingHistogram';
import {
  QUESTION_TYPE_LABELS,
  type FeedbackQuestion,
  type QuestionStats,
} from '../../types/feedback';

interface ResultsQuestionCardProps {
  question: FeedbackQuestion;
  stats: QuestionStats;
  totalResponses: number;
}

const ResultsQuestionCard: React.FC<ResultsQuestionCardProps> = ({
  question,
  stats,
  totalResponses,
}) => {
  return (
    <article className="chamfer feedback-panel feedback-results-card">
      <header className="feedback-results-card__header">
        <h3>{question.label}</h3>
        <span className="feedback-results-card__badges">
          {question.archived && <span className="feedback-badge feedback-badge--closed">Archived</span>}
          <span className="feedback-badge">{QUESTION_TYPE_LABELS[question.type]}</span>
        </span>
      </header>
      <p className="chart-muted">
        {stats.answered} of {totalResponses} respondents answered
      </p>

      {stats.kind === 'choice' && (
        <BarList
          caption={question.label}
          total={stats.answered}
          items={stats.counts.map((c) => ({ key: c.optionId, label: c.label, count: c.count }))}
        />
      )}

      {stats.kind === 'rating' && (
        <RatingHistogram
          caption={question.label}
          distribution={stats.distribution}
          mean={stats.mean}
          answered={stats.answered}
          config={question.config}
        />
      )}

      {stats.kind === 'text' &&
        (stats.latest.length === 0 ? (
          <p className="chart-muted">No answers yet.</p>
        ) : (
          <ul className="feedback-text-answers">
            {stats.latest.map((answer) => (
              <li key={answer.responseId}>
                <p className="feedback-prewrap">{answer.value}</p>
                <time dateTime={answer.createdAt} className="chart-muted">
                  {new Date(answer.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
            {stats.answered > stats.latest.length && (
              <li className="chart-muted">
                Showing the {stats.latest.length} latest answers. Export the CSV for all of them.
              </li>
            )}
          </ul>
        ))}
    </article>
  );
};

export default ResultsQuestionCard;
