import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAuth } from '../providers/AuthProvider';
import { SortableItem } from '../components/SortableItem';
import ConfirmModal from '../components/ConfirmModal';
import FormMetaModal from '../components/feedback/FormMetaModal';
import QuestionEditModal from '../components/feedback/QuestionEditModal';
import {
  ApiError,
  createFeedbackQuestion,
  deleteFeedbackQuestion,
  getAdminFeedbackForm,
  reorderFeedbackQuestions,
  updateFeedbackForm,
  updateFeedbackQuestion,
} from '../lib/api';
import { isBackendConfigured } from '../config/env';
import {
  QUESTION_TYPE_LABELS,
  STATUS_LABELS,
  type AdminFeedbackForm,
  type AdminFeedbackQuestion,
  type FormInput,
  type QuestionInput,
} from '../types/feedback';
import '../styles/feedback.css';
import '../styles/roadmap.css';
import '../styles/confirm-modal.css';

function apiErrorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError && err.data?.message ? err.data.message : fallback;
}

function toInput(question: AdminFeedbackQuestion): QuestionInput {
  const { type, label, description, required, options, config } = question;
  return { type, label, description, required, options, config };
}

function questionSummary(question: AdminFeedbackQuestion) {
  if (question.options) return question.options.map((o) => o.label).join(' · ');
  if (question.type === 'RATING') {
    const { minLabel, maxLabel } = question.config ?? {};
    return minLabel || maxLabel ? `1 = ${minLabel ?? '…'} · 5 = ${maxLabel ?? '…'}` : '1 to 5';
  }
  return null;
}

const FeedbackEditor: React.FC = () => {
  const { formId = '' } = useParams<{ formId: string }>();
  const { isAuthenticated, isLoading: authLoading, accessToken } = useAuth();
  const [form, setForm] = useState<AdminFeedbackForm | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminFeedbackQuestion | 'new' | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdminFeedbackQuestion | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchForm = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setForm(await getAdminFeedbackForm(formId, accessToken));
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404 ? 'Form not found.' : 'Failed to load the form.'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [formId, accessToken]);

  useEffect(() => {
    if (!isBackendConfigured || authLoading) return;
    if (accessToken) fetchForm();
    else setLoading(false);
  }, [fetchForm, authLoading, accessToken]);

  const active = form?.questions.filter((q) => !q.archived) ?? [];
  const archived = form?.questions.filter((q) => q.archived) ?? [];

  // The order endpoint needs every question, archived ones last.
  const applyOrder = async (ordered: AdminFeedbackQuestion[]) => {
    if (!form || !accessToken) return;

    const orderedIds = new Set(ordered.map((q) => q.id));
    const all = [...ordered, ...form.questions.filter((q) => !orderedIds.has(q.id))];
    setForm({ ...form, questions: all.map((q, index) => ({ ...q, position: index + 1 })) });

    try {
      await reorderFeedbackQuestions(form.id, all.map((q) => q.id), accessToken);
    } catch (err) {
      setError('Failed to save the question order.');
      console.error(err);
      await fetchForm();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const oldIndex = active.findIndex((q) => q.id === dragged.id);
    const newIndex = active.findIndex((q) => q.id === over.id);
    await applyOrder(arrayMove(active, oldIndex, newIndex));
  };

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= active.length) return;
    await applyOrder(arrayMove(active, index, newIndex));
  };

  const openEditor = (question: AdminFeedbackQuestion | 'new') => {
    setModalError(null);
    setEditing(question);
  };

  const handleSaveQuestion = async (input: QuestionInput) => {
    if (!form || !accessToken || !editing) return;

    try {
      if (editing === 'new') {
        await createFeedbackQuestion(form.id, input, accessToken);
      } else {
        await updateFeedbackQuestion(editing.id, input, accessToken);
      }
      setEditing(null);
      await fetchForm();
    } catch (err) {
      setModalError(apiErrorMessage(err, 'Failed to save the question.'));
      console.error(err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete || !accessToken) return;

    try {
      await deleteFeedbackQuestion(toDelete.id, accessToken);
      await fetchForm();
    } catch (err) {
      setError('Failed to delete the question.');
      console.error(err);
    } finally {
      setToDelete(null);
    }
  };

  const handleRestore = async (question: AdminFeedbackQuestion) => {
    if (!accessToken) return;

    try {
      await updateFeedbackQuestion(question.id, { ...toInput(question), archived: false }, accessToken);
      await applyOrder([...active, { ...question, archived: false }]);
      await fetchForm();
    } catch (err) {
      setError('Failed to restore the question.');
      console.error(err);
    }
  };

  const handleSaveSettings = async (input: FormInput) => {
    if (!form || !accessToken) return;

    try {
      await updateFeedbackForm(form.id, input, accessToken);
      setIsSettingsOpen(false);
      await fetchForm();
    } catch (err) {
      setModalError(apiErrorMessage(err, 'Failed to save the form.'));
      console.error(err);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="feedback-page-container" role="status" aria-live="polite">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || !form) {
    return (
      <div className="feedback-page-container">
        <p className="error-message" role="alert">
          {isAuthenticated ? error : 'Sign in as an administrator to edit feedback forms.'}
        </p>
        <Link to="/feedback">Back to feedback</Link>
      </div>
    );
  }

  return (
    <div className="feedback-page-container">
      {editing && (
        <QuestionEditModal
          question={editing === 'new' ? null : editing}
          error={modalError}
          onSave={handleSaveQuestion}
          onClose={() => setEditing(null)}
        />
      )}
      {isSettingsOpen && (
        <FormMetaModal
          form={form}
          error={modalError}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={toDelete?.answerCount ? 'Archive question' : 'Delete question'}
      >
        <p>
          {toDelete?.answerCount
            ? `“${toDelete.label}” has ${toDelete.answerCount} answers. It will be removed from the form but its results stay available.`
            : `Delete “${toDelete?.label}”?`}
        </p>
      </ConfirmModal>

      <Link to="/feedback" className="back-link">
        ← All forms
      </Link>
      <header className="page-header">
        <h1 className="page-title">
          <span className="page-title__accent" aria-hidden="true">&gt;</span> {form.title}
        </h1>
        <p className="page-subtitle">
          {STATUS_LABELS[form.status]} · /feedback/{form.slug}
        </p>
        <div className="admin-controls feedback-actions">
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setIsSettingsOpen(true);
            }}
          >
            Settings
          </button>
          <Link to={`/feedback/${form.id}/results`}>Results</Link>
          {form.status !== 'DRAFT' && <Link to={`/feedback/${form.slug}`}>View form</Link>}
        </div>
      </header>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="feedback-section-header">
        <h2>Questions</h2>
        <button type="button" onClick={() => openEditor('new')}>
          Add question
        </button>
      </div>

      {active.length === 0 && <p>No questions yet. Add the first one.</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={active.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ol className="feedback-question-list" aria-label="Questions">
            {active.map((question, index) => {
              const summary = questionSummary(question);
              return (
                <SortableItem key={question.id} id={question.id} className="feedback-question-item">
                  <div className="chamfer card">
                    <div className="card-body">
                      <div className="feedback-question-item__header">
                        <span className="title">
                          {index + 1}. {question.label}
                          {question.required && (
                            <span className="feedback-question__required" aria-label="(required)">
                              {' '}
                              *
                            </span>
                          )}
                        </span>
                        <span className="feedback-badge">{QUESTION_TYPE_LABELS[question.type]}</span>
                      </div>
                      {summary && <p className="feedback-question-item__summary">{summary}</p>}
                      <p className="feedback-question-item__summary">
                        {question.answerCount} answers
                      </p>
                      <div className="admin-controls">
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${question.label} up`}
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, 1)}
                          disabled={index === active.length - 1}
                          aria-label={`Move ${question.label} down`}
                        >
                          Move down
                        </button>
                        <button type="button" onClick={() => openEditor(question)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => setToDelete(question)}>
                          {question.answerCount ? 'Archive' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                </SortableItem>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>

      {archived.length > 0 && (
        <details className="feedback-archived">
          <summary>Archived questions ({archived.length})</summary>
          <ul>
            {archived.map((question) => (
              <li key={question.id}>
                <span>
                  {question.label}{' '}
                  <span className="feedback-question-item__summary">
                    ({QUESTION_TYPE_LABELS[question.type]}, {question.answerCount} answers)
                  </span>
                </span>
                <button type="button" className="secondary" onClick={() => handleRestore(question)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default FeedbackEditor;
