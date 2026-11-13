import React, { useState } from 'react';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import QuestionField from './QuestionField';
import {
  QUESTION_TYPE_LABELS,
  type AdminFeedbackQuestion,
  type AnswerValue,
  type ChoiceOption,
  type QuestionInput,
  type QuestionType,
} from '../../types/feedback';
import '../../styles/roadmap-form.css';

interface QuestionEditModalProps {
  question: AdminFeedbackQuestion | null;
  error?: string | null;
  onSave: (input: QuestionInput) => void;
  onClose: () => void;
}

const isChoice = (type: QuestionType) => type === 'SINGLE_CHOICE' || type === 'MULTI_CHOICE';

const newOption = (label = ''): ChoiceOption => ({ id: crypto.randomUUID(), label });

const QuestionEditModal: React.FC<QuestionEditModalProps> = ({
  question,
  error,
  onSave,
  onClose,
}) => {
  const [type, setType] = useState<QuestionType>(question?.type ?? 'SINGLE_CHOICE');
  const [label, setLabel] = useState(question?.label ?? '');
  const [description, setDescription] = useState(question?.description ?? '');
  const [required, setRequired] = useState(question?.required ?? false);
  const [options, setOptions] = useState<ChoiceOption[]>(
    question?.options ?? [newOption(), newOption()]
  );
  const [minLabel, setMinLabel] = useState(question?.config?.minLabel ?? '');
  const [maxLabel, setMaxLabel] = useState(question?.config?.maxLabel ?? '');
  const [previewValue, setPreviewValue] = useState<AnswerValue | undefined>(undefined);
  const [localError, setLocalError] = useState<string | null>(null);
  const { titleId, overlayProps, dialogProps } = useAccessibleDialog({
    isOpen: true,
    onClose,
  });

  const typeLocked = (question?.answerCount ?? 0) > 0;

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as QuestionType;
    setType(next);
    setPreviewValue(undefined);
    if (isChoice(next) && options.length === 0) setOptions([newOption(), newOption()]);
  };

  const updateOption = (id: string, value: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, label: value } : o)));
  };

  const moveOption = (index: number, direction: -1 | 1) => {
    setOptions((prev) => {
      const next = [...prev];
      const target = index + direction;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeOption = (id: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== id));
  };

  const input: QuestionInput = {
    type,
    label: label.trim(),
    description: description.trim() || null,
    required,
    options: isChoice(type)
      ? options.map((o) => ({ ...o, label: o.label.trim() })).filter((o) => o.label)
      : null,
    config:
      type === 'RATING'
        ? {
            ...(minLabel.trim() && { minLabel: minLabel.trim() }),
            ...(maxLabel.trim() && { maxLabel: maxLabel.trim() }),
          }
        : null,
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.label) {
      setLocalError('Write the question first.');
      return;
    }
    if (isChoice(type) && !input.options?.length) {
      setLocalError('Add at least one option.');
      return;
    }
    setLocalError(null);
    onSave(input);
  };

  const shownError = localError ?? error;

  return (
    <div className="roadmap-modal-overlay" {...overlayProps}>
      <div className="chamfer roadmap-modal-content" {...dialogProps}>
        {/* noValidate: the preview's required inputs must not block saving */}
        <form className="roadmap-form roadmap-modal-body" onSubmit={handleSubmit} noValidate>
          <h2 id={titleId}>{question ? 'Edit question' : 'Add question'}</h2>
          <label>
            Type
            <select
              value={type}
              onChange={handleTypeChange}
              disabled={typeLocked}
              aria-describedby={typeLocked ? `${titleId}-type-hint` : undefined}
            >
              {Object.entries(QUESTION_TYPE_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
            {typeLocked && (
              <small id={`${titleId}-type-hint`} className="feedback-field-hint">
                This question already has answers, so its type cannot change.
              </small>
            )}
          </label>
          <label>
            Question
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={191}
              required
            />
          </label>
          <label>
            Help text (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            Required
          </label>

          {isChoice(type) && (
            <fieldset className="feedback-options-editor">
              <legend>Options</legend>
              <ol>
                {options.map((option, index) => (
                  <li key={option.id}>
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => updateOption(option.id, e.target.value)}
                      maxLength={191}
                      aria-label={`Option ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => moveOption(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move option ${index + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => moveOption(index, 1)}
                      disabled={index === options.length - 1}
                      aria-label={`Move option ${index + 1} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeOption(option.id)}
                      aria-label={`Remove option ${index + 1}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="secondary"
                onClick={() => setOptions((prev) => [...prev, newOption()])}
              >
                Add option
              </button>
            </fieldset>
          )}

          {type === 'RATING' && (
            <div className="feedback-rating-labels-editor">
              <label>
                Label for 1 (optional)
                <input
                  type="text"
                  value={minLabel}
                  onChange={(e) => setMinLabel(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Not at all"
                />
              </label>
              <label>
                Label for 5 (optional)
                <input
                  type="text"
                  value={maxLabel}
                  onChange={(e) => setMaxLabel(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Very much"
                />
              </label>
            </div>
          )}

          <section className="feedback-preview" aria-label="Preview">
            <h3>Preview</h3>
            <QuestionField
              question={{
                ...input,
                id: question?.id ?? 'preview',
                formId: question?.formId ?? '',
                position: 0,
                archived: false,
                label: input.label || 'Your question',
              }}
              value={previewValue}
              onChange={setPreviewValue}
            />
          </section>

          {shownError && (
            <p className="error-message" role="alert">
              {shownError}
            </p>
          )}
          <div className="form-buttons">
            <button type="submit">Save</button>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuestionEditModal;
