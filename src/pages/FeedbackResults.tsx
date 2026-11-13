import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import ConfirmModal from '../components/ConfirmModal';
import ResultsQuestionCard from '../components/feedback/ResultsQuestionCard';
import Timeline from '../components/feedback/charts/Timeline';
import {
  ApiError,
  deleteFeedbackResponse,
  downloadFeedbackCsv,
  getFeedbackResponses,
  getFeedbackStats,
} from '../lib/api';
import { isBackendConfigured } from '../config/env';
import type {
  AnswerValue,
  FeedbackQuestion,
  FormStats,
  ResponsesPage,
} from '../types/feedback';
import '../styles/feedback.css';
import '../styles/roadmap.css';
import '../styles/confirm-modal.css';

function formatAnswer(question: FeedbackQuestion, value: AnswerValue | undefined) {
  if (value === undefined) return '';
  if (!question.options) return String(value);
  const labels = new Map(question.options.map((o) => [o.id, o.label]));
  return (Array.isArray(value) ? value : [value]).map((id) => labels.get(String(id)) ?? id).join(', ');
}

const formatDate = (date: string | null) => (date ? new Date(date).toLocaleString() : '–');

const FeedbackResults: React.FC = () => {
  const { formId = '' } = useParams<{ formId: string }>();
  const { isAuthenticated, isLoading: authLoading, accessToken } = useAuth();
  const [stats, setStats] = useState<FormStats | null>(null);
  const [responses, setResponses] = useState<ResponsesPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!accessToken) return;

    try {
      setStats(await getFeedbackStats(formId, accessToken));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? 'Form not found.'
          : 'Failed to load the results.'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [formId, accessToken]);

  const fetchResponses = useCallback(async () => {
    if (!accessToken) return;

    try {
      setResponses(await getFeedbackResponses(formId, page, accessToken));
    } catch (err) {
      setError('Failed to load the responses.');
      console.error(err);
    }
  }, [formId, page, accessToken]);

  useEffect(() => {
    if (!isBackendConfigured || authLoading) return;
    if (accessToken) fetchStats();
    else setLoading(false);
  }, [fetchStats, authLoading, accessToken]);

  useEffect(() => {
    if (isBackendConfigured && !authLoading) fetchResponses();
  }, [fetchResponses, authLoading]);

  const handleExport = async () => {
    if (!stats || !accessToken) return;

    try {
      setExporting(true);
      await downloadFeedbackCsv(stats.form.id, stats.form.slug, accessToken);
    } catch (err) {
      setError('Failed to export the responses.');
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete || !accessToken) return;

    try {
      await deleteFeedbackResponse(toDelete, accessToken);
      // Stay in range when the last row of the last page is deleted
      if (responses && responses.items.length === 1 && page > 1) setPage(page - 1);
      else await fetchResponses();
      await fetchStats();
    } catch (err) {
      setError('Failed to delete the response.');
      console.error(err);
    } finally {
      setToDelete(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="feedback-page-container" role="status" aria-live="polite">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || !stats) {
    return (
      <div className="feedback-page-container">
        <p className="error-message" role="alert">
          {isAuthenticated ? error : 'Sign in as an administrator to see feedback results.'}
        </p>
        <Link to="/feedback">Back to feedback</Link>
      </div>
    );
  }

  const questions = stats.questions.map((q) => q.question);
  const pageCount = responses ? Math.max(Math.ceil(responses.total / responses.pageSize), 1) : 1;

  return (
    <div className="feedback-page-container feedback-page-container--wide">
      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete response"
      >
        <p>Delete this response and all its answers? This cannot be undone.</p>
      </ConfirmModal>

      <Link to="/feedback" className="back-link">
        ← All forms
      </Link>
      <header className="page-header">
        <h1 className="page-title">
          <span className="page-title__accent" aria-hidden="true">&gt;</span> {stats.form.title}
        </h1>
        <p className="page-subtitle">Results</p>
        <div className="admin-controls feedback-actions">
          <Link to={`/feedback/${stats.form.id}/edit`}>Questions</Link>
          <button type="button" onClick={handleExport} disabled={exporting || !stats.totalResponses}>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <section className="feedback-summary" aria-label="Summary">
        <div className="chamfer feedback-panel feedback-stat">
          <span className="chart-muted">Responses</span>
          <span className="feedback-stat__value">{stats.totalResponses}</span>
        </div>
        <div className="chamfer feedback-panel feedback-stat">
          <span className="chart-muted">First response</span>
          <span className="feedback-stat__date">{formatDate(stats.firstResponseAt)}</span>
        </div>
        <div className="chamfer feedback-panel feedback-stat">
          <span className="chart-muted">Latest response</span>
          <span className="feedback-stat__date">{formatDate(stats.lastResponseAt)}</span>
        </div>
      </section>

      <Timeline perDay={stats.perDay} />

      <h2 className="feedback-results-heading">Questions</h2>
      {stats.questions.length === 0 && <p>This form has no questions.</p>}
      <div className="feedback-results-grid">
        {stats.questions.map(({ question, stats: questionStats }) => (
          <ResultsQuestionCard
            key={question.id}
            question={question}
            stats={questionStats}
            totalResponses={stats.totalResponses}
          />
        ))}
      </div>

      <h2 className="feedback-results-heading">Individual responses</h2>
      {!responses || responses.total === 0 ? (
        <p>No responses yet.</p>
      ) : (
        <>
          <div className="feedback-table-wrapper" tabIndex={0} aria-label="Individual responses">
            <table className="feedback-table">
              <thead>
                <tr>
                  <th scope="col">Submitted</th>
                  <th scope="col">Respondent</th>
                  {questions.map((q) => (
                    <th key={q.id} scope="col">
                      {q.label}
                      {q.archived && ' (archived)'}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {responses.items.map((response) => (
                  <tr key={response.id}>
                    <th scope="row">{new Date(response.createdAt).toLocaleString()}</th>
                    <td>{response.respondent ?? <span className="chart-muted">Anonymous</span>}</td>
                    {questions.map((q) => (
                      <td key={q.id}>{formatAnswer(q, response.answers[q.id])}</td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setToDelete(response.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <nav className="feedback-pagination" aria-label="Responses pages">
              <button
                type="button"
                className="secondary"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                Previous
              </button>
              <span>
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                className="secondary"
                onClick={() => setPage(page + 1)}
                disabled={page >= pageCount}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
};

export default FeedbackResults;
