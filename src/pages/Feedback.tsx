import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  HiOutlineArrowRight,
  HiOutlineChartBar,
  HiOutlineCog6Tooth,
  HiOutlineDocumentDuplicate,
  HiOutlineEye,
  HiOutlineLockClosed,
  HiOutlineLockOpen,
  HiOutlinePencilSquare,
  HiOutlinePlus,
  HiOutlineTrash,
} from 'react-icons/hi2';
import { useAuth } from '../providers/AuthProvider';
import ConfirmModal from '../components/ConfirmModal';
import FormMetaModal from '../components/feedback/FormMetaModal';
import { BUTTON } from '../components/feedback/buttons';
import { useScrollReveal } from '../hooks/useScrollReveal';
import {
  ApiError,
  createFeedbackForm,
  deleteFeedbackForm,
  duplicateFeedbackForm,
  getAdminFeedbackForms,
  getOpenFeedbackForms,
  updateFeedbackForm,
} from '../lib/api';
import { isBackendConfigured } from '../config/env';
import type {
  FeedbackFormListItem,
  FeedbackFormStatus,
  FeedbackFormSummary,
  FormInput,
} from '../types/feedback';
import '../styles/feedback.css';
import '../styles/roadmap-form.css';
import '../styles/confirm-modal.css';

const STATUS_BADGES: Record<FeedbackFormStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  CLOSED: 'Closed',
};

function apiErrorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.data?.message ? err.data.message : fallback;
}

// Signed-in users without the admin role only get the public view.
async function getAdminForms(accessToken: string) {
  try {
    return await getAdminFeedbackForms(accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) return null;
    throw err;
  }
}

const Feedback: React.FC = () => {
  const { isLoading: authLoading, accessToken } = useAuth();
  const navigate = useNavigate();
  const [openForms, setOpenForms] = useState<FeedbackFormSummary[]>([]);
  const [adminForms, setAdminForms] = useState<FeedbackFormListItem[] | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedForm, setSelectedForm] = useState<FeedbackFormListItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [formToDelete, setFormToDelete] = useState<FeedbackFormListItem | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  useScrollReveal(pageRef, !loading && !authLoading);

  const fetchForms = useCallback(async () => {
    try {
      setLoading(true);
      setOpenForms(await getOpenFeedbackForms());
      setAdminForms(accessToken ? await getAdminForms(accessToken) : null);
      setError(null);
    } catch (err) {
      setError('Failed to fetch feedback forms.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isBackendConfigured && !authLoading) fetchForms();
  }, [fetchForms, authLoading]);

  const handleCreate = () => {
    setSelectedForm(null);
    setModalError(null);
    setIsFormOpen(true);
  };

  const handleEdit = (form: FeedbackFormListItem) => {
    setSelectedForm(form);
    setModalError(null);
    setIsFormOpen(true);
  };

  const handleSave = async (input: FormInput) => {
    if (!accessToken) return;

    try {
      if (selectedForm) {
        await updateFeedbackForm(selectedForm.id, input, accessToken);
        setIsFormOpen(false);
        await fetchForms();
      } else {
        const created = await createFeedbackForm(input, accessToken);
        navigate(`/feedback/${created.id}/edit`);
      }
    } catch (err) {
      setModalError(apiErrorMessage(err, 'Failed to save the form.'));
      console.error(err);
    }
  };

  const setStatus = async (form: FeedbackFormListItem, status: FeedbackFormStatus) => {
    if (!accessToken) return;

    try {
      const { title, slug, description } = form;
      await updateFeedbackForm(form.id, { title, slug, description, status }, accessToken);
      await fetchForms();
    } catch (err) {
      setError('Failed to update the form status.');
      console.error(err);
    }
  };

  const handleDuplicate = async (form: FeedbackFormListItem) => {
    if (!accessToken) return;

    try {
      const copy = await duplicateFeedbackForm(form.id, accessToken);
      navigate(`/feedback/${copy.id}/edit`);
    } catch (err) {
      setError('Failed to duplicate the form.');
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!formToDelete || !accessToken) return;

    try {
      await deleteFeedbackForm(formToDelete.id, accessToken);
      await fetchForms();
    } catch (err) {
      setError('Failed to delete the form.');
      console.error(err);
    } finally {
      setFormToDelete(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="feedback-page-container" role="status" aria-live="polite">
        Loading...
      </div>
    );
  }

  // Visitors go straight to the form when only one is open.
  if (!adminForms && !error && openForms.length === 1) {
    return <Navigate to={`/feedback/${openForms[0].slug}`} replace />;
  }

  return (
    <div ref={pageRef} className="feedback-page-container">
      {isFormOpen && (
        <FormMetaModal
          form={selectedForm}
          error={modalError}
          onSave={handleSave}
          onClose={() => setIsFormOpen(false)}
        />
      )}
      <ConfirmModal
        isOpen={formToDelete !== null}
        onClose={() => setFormToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete form"
      >
        <p>
          Delete “{formToDelete?.title}” and its {formToDelete?.responseCount ?? 0} responses?
          This cannot be undone.
        </p>
      </ConfirmModal>

      <header className="page-header">
        <p className="kicker">
          <span className="kicker__sep">//</span> Beta testing
        </p>
        <h1 className="page-title">
          <span className="page-title__accent" aria-hidden="true">&gt;</span> Feedback
        </h1>
        <p className="page-subtitle">
          Testing a beta of Lucy? Tell us{' '}
          <span className="page-title__accent">what works and what doesn't</span>. Answers are
          anonymous.
        </p>
      </header>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      {adminForms && (
        <section className="feedback-admin" aria-labelledby="feedback-admin-title">
          <div className="feedback-section-header">
            <div>
              <p className="kicker">
                01 <span className="kicker__sep">//</span> Admin
              </p>
              <h2 id="feedback-admin-title">All forms</h2>
            </div>
            <button type="button" className={BUTTON.mainAction} onClick={handleCreate}>
              <HiOutlinePlus aria-hidden="true" />
              Create form
            </button>
          </div>

          {adminForms.length === 0 ? (
            <p>No forms yet.</p>
          ) : (
            <ul className="feedback-form-list">
              {adminForms.map((form) => (
                <li key={form.id} className="chamfer card feedback-form-item" data-reveal>
                  <div className="card-body">
                    <div className="feedback-form-item__header">
                      <span className="title">{form.title}</span>
                      <span className={`feedback-badge feedback-badge--${form.status.toLowerCase()}`}>
                        {STATUS_BADGES[form.status]}
                      </span>
                    </div>
                    <p className="feedback-form-item__meta">
                      /feedback/{form.slug} · {form.questionCount} questions ·{' '}
                      {form.responseCount} responses
                    </p>
                    <div className="admin-controls feedback-actions">
                      <Link to={`/feedback/${form.id}/edit`} className={BUTTON.action}>
                        <HiOutlinePencilSquare aria-hidden="true" />
                        Questions
                      </Link>
                      <Link to={`/feedback/${form.id}/results`} className={BUTTON.action}>
                        <HiOutlineChartBar aria-hidden="true" />
                        Results
                      </Link>
                      {form.status !== 'DRAFT' && (
                        <Link to={`/feedback/${form.slug}`} className={BUTTON.action}>
                          <HiOutlineEye aria-hidden="true" />
                          View
                        </Link>
                      )}
                      <button type="button" className={BUTTON.action} onClick={() => handleEdit(form)}>
                        <HiOutlineCog6Tooth aria-hidden="true" />
                        Settings
                      </button>
                      {form.status === 'OPEN' ? (
                        <button
                          type="button"
                          className={BUTTON.action}
                          onClick={() => setStatus(form, 'CLOSED')}
                        >
                          <HiOutlineLockClosed aria-hidden="true" />
                          Close
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={BUTTON.action}
                          onClick={() => setStatus(form, 'OPEN')}
                        >
                          <HiOutlineLockOpen aria-hidden="true" />
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        className={BUTTON.action}
                        onClick={() => handleDuplicate(form)}
                      >
                        <HiOutlineDocumentDuplicate aria-hidden="true" />
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className={BUTTON.danger}
                        onClick={() => setFormToDelete(form)}
                      >
                        <HiOutlineTrash aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="feedback-open-title">
        {adminForms && (
          <div className="feedback-section-header">
            <div>
              <p className="kicker">
                02 <span className="kicker__sep">//</span> Public
              </p>
              <h2 id="feedback-open-title">Open forms</h2>
            </div>
          </div>
        )}
        {!adminForms && (
          <h2 id="feedback-open-title" className="sr-only">
            Open forms
          </h2>
        )}
        {openForms.length === 0 ? (
          <p className="feedback-empty">
            There is no feedback form open right now. Come back during the next beta!
          </p>
        ) : (
          <ul className="feedback-form-list">
            {openForms.map((form, index) => (
              <li key={form.id} data-reveal>
                <Link to={`/feedback/${form.slug}`} className="chamfer card feedback-form-link">
                  <span className="card-body">
                    <span className="feedback-form-link__index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="feedback-form-link__text">
                      <span className="title">{form.title}</span>
                      {form.description && (
                        <span className="feedback-form-link__description">{form.description}</span>
                      )}
                    </span>
                    <HiOutlineArrowRight className="feedback-form-link__arrow" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default Feedback;
