import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QuestionField from '../components/feedback/QuestionField';
import { useAuth } from '../providers/AuthProvider';
import { ApiError, getFeedbackForm, submitFeedback } from '../lib/api';
import { isBackendConfigured } from '../config/env';
import {
  RESPONDENT_MAX,
  type AnswerValue,
  type Answers,
  type PublicFeedbackForm,
} from '../types/feedback';
import '../styles/feedback.css';

interface StoredSubmission {
  submittedAt: string;
  answers: Answers;
  respondent: string;
}

const submissionsKey = (slug: string) => `feedback-submissions:${slug}`;

// Storage can be unavailable (private mode) or hold anything: it is only a convenience.
function readSubmissions(slug: string): StoredSubmission[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(submissionsKey(slug)) ?? '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function storeSubmissions(slug: string, submissions: StoredSubmission[]) {
  try {
    localStorage.setItem(submissionsKey(slug), JSON.stringify(submissions));
  } catch {
    // The answers were sent, only the local copy is lost.
  }
}

function isEmpty(value: AnswerValue | undefined) {
  if (value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

const FeedbackFormPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState<PublicFeedbackForm | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [respondent, setRespondent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissions, setSubmissions] = useState(() => readSubmissions(slug));
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isBackendConfigured) return;

    const fetchForm = async () => {
      try {
        setLoading(true);
        setForm(await getFeedbackForm(slug));
        setLoadError(null);
      } catch (err) {
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? 'This feedback form does not exist.'
            : 'Failed to load the feedback form.'
        );
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [slug]);

  const setAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setErrors(({ [questionId]: _removed, ...rest }) => rest);
  };

  const showErrors = (next: Record<string, string>) => {
    setErrors(next);
    requestAnimationFrame(() => summaryRef.current?.focus());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const missing: Record<string, string> = {};
    for (const question of form.questions) {
      if (question.required && isEmpty(answers[question.id])) {
        missing[question.id] = 'This question is required.';
      }
    }
    if (Object.keys(missing).length) {
      showErrors(missing);
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);
      const name = respondent.trim();
      await submitFeedback(slug, answers, name, honeypotRef.current?.value ?? '');
      const next = [
        ...submissions,
        { submittedAt: new Date().toISOString(), answers, respondent: name },
      ];
      storeSubmissions(slug, next);
      setSubmissions(next);
      setSubmitted(true);
      window.umami?.track('Feedback submitted', { form: slug });
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) {
        showErrors(err.data.errors);
      } else if (err instanceof ApiError && err.status === 429) {
        setSubmitError('Too many submissions from your network. Please try again later.');
      } else if (err instanceof ApiError && err.status === 403) {
        setSubmitError('This form has been closed and no longer accepts answers.');
      } else {
        setSubmitError('Failed to send your feedback. Please try again.');
      }
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setAnswers({});
    setErrors({});
    setSubmitted(false);
    setNoticeDismissed(true);
  };

  if (loading) {
    return (
      <div className="feedback-page-container" role="status" aria-live="polite">
        Loading...
      </div>
    );
  }

  if (!form) {
    return (
      <div className="feedback-page-container">
        <p className="error-message" role="alert">
          {loadError ?? 'Feedback forms are unavailable.'}
        </p>
        <Link to="/feedback">Back to feedback</Link>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const lastSubmission = submissions.at(-1);

  return (
    <div className="feedback-page-container">
      <header className="page-header">
        <h1 className="page-title">
          <span className="page-title__accent" aria-hidden="true">&gt;</span> {form.title}
        </h1>
        {form.description && <p className="page-subtitle feedback-prewrap">{form.description}</p>}
        {isAuthenticated && (
          <div className="admin-controls feedback-admin-links">
            <Link to={`/feedback/${form.id}/edit`}>Edit form</Link>
            <Link to={`/feedback/${form.id}/results`}>Results</Link>
          </div>
        )}
      </header>

      {submitted ? (
        <section className="chamfer feedback-panel feedback-thanks" aria-live="polite">
          <h2>Thank you!</h2>
          <p>Your feedback was sent. It helps us make Lucy better.</p>
          {form.allowMultipleResponses && (
            <button type="button" className="secondary" onClick={resetForm}>
              Send another response
            </button>
          )}
        </section>
      ) : form.status === 'CLOSED' ? (
        <section className="chamfer feedback-panel">
          <h2>This form is closed</h2>
          <p>It no longer accepts answers. Thank you for your interest!</p>
        </section>
      ) : lastSubmission && !form.allowMultipleResponses ? (
        <section className="feedback-sent-answers" aria-labelledby="feedback-sent-heading">
          <div className="chamfer feedback-panel">
            <h2 id="feedback-sent-heading">You already answered this form</h2>
            <p>
              Thank you! Here is what you sent on{' '}
              {new Date(lastSubmission.submittedAt).toLocaleString()}
              {lastSubmission.respondent ? ` as ${lastSubmission.respondent}` : ''}.
            </p>
          </div>
          {form.questions.map((question) => (
            <div key={question.id} className="chamfer feedback-panel">
              <QuestionField
                question={question}
                value={lastSubmission.answers[question.id]}
                onChange={() => {}}
                disabled
              />
            </div>
          ))}
        </section>
      ) : (
        <>
          {submissions.length > 0 && !noticeDismissed && (
            <div className="feedback-notice" role="status">
              <p>You already sent feedback with this form from this browser.</p>
              <button type="button" className="secondary" onClick={() => setNoticeDismissed(true)}>
                Dismiss
              </button>
            </div>
          )}

          <form className="feedback-form" onSubmit={handleSubmit} noValidate>
            {/* Honeypot: hidden from people, bots fill it in */}
            <div className="feedback-honeypot" aria-hidden="true">
              <label>
                Website
                <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>

            {form.questions.length === 0 && <p>This form has no questions yet.</p>}

            {form.questions.map((question) => (
              <div key={question.id} className="chamfer feedback-panel">
                <QuestionField
                  question={question}
                  value={answers[question.id]}
                  onChange={(value) => setAnswer(question.id, value)}
                  error={errors[question.id]}
                />
              </div>
            ))}

            {form.questions.length > 0 && (
              <div className="chamfer feedback-panel">
                <div className="feedback-question">
                  <label htmlFor="feedback-respondent" className="feedback-question__label">
                    Your name or Discord ID (optional)
                  </label>
                  <p id="feedback-respondent-hint" className="feedback-question__description">
                    Only if you want us to know who you are. Leave it empty to stay anonymous.
                  </p>
                  <input
                    id="feedback-respondent"
                    type="text"
                    value={respondent}
                    onChange={(e) => setRespondent(e.target.value)}
                    maxLength={RESPONDENT_MAX}
                    autoComplete="nickname"
                    aria-describedby="feedback-respondent-hint"
                  />
                </div>
              </div>
            )}

            <div
              ref={summaryRef}
              tabIndex={-1}
              className="feedback-form__status"
              role={errorCount || submitError ? 'alert' : undefined}
            >
              {errorCount > 0 && (
                <p className="error-message">
                  {errorCount === 1
                    ? '1 question needs your attention.'
                    : `${errorCount} questions need your attention.`}
                </p>
              )}
              {submitError && <p className="error-message">{submitError}</p>}
            </div>

            <div className="form-buttons">
              <button type="submit" disabled={submitting || form.questions.length === 0}>
                {submitting ? 'Sending...' : 'Send feedback'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default FeedbackFormPage;
