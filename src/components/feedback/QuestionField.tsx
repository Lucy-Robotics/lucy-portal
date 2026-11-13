import React, { useId } from 'react';
import {
  LONG_TEXT_MAX,
  RATING_VALUES,
  SHORT_TEXT_MAX,
  type AnswerValue,
  type FeedbackQuestion,
} from '../../types/feedback';

interface QuestionFieldProps {
  question: FeedbackQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  error?: string;
  disabled?: boolean;
}

const RequiredMark: React.FC = () => (
  <>
    <span className="feedback-question__required" aria-hidden="true">
      *
    </span>
    <span className="sr-only"> (required)</span>
  </>
);

const QuestionField: React.FC<QuestionFieldProps> = ({
  question,
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const baseId = useId();
  const descriptionId = `${baseId}-description`;
  const errorId = `${baseId}-error`;
  const describedBy =
    [question.description && descriptionId, error && errorId].filter(Boolean).join(' ') ||
    undefined;

  const heading = (
    <>
      {question.label}
      {question.required && <RequiredMark />}
    </>
  );

  const description = question.description && (
    <p id={descriptionId} className="feedback-question__description">
      {question.description}
    </p>
  );

  const errorMessage = error && (
    <p id={errorId} className="feedback-question__error" role="alert">
      {error}
    </p>
  );

  const className = `feedback-question ${error ? 'feedback-question--invalid' : ''}`;

  if (question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT') {
    const isLong = question.type === 'LONG_TEXT';
    const text = typeof value === 'string' ? value : '';
    const inputId = `${baseId}-input`;
    const common = {
      id: inputId,
      value: text,
      disabled,
      required: question.required,
      maxLength: isLong ? LONG_TEXT_MAX : SHORT_TEXT_MAX,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChange(e.target.value),
    };

    return (
      <div className={className}>
        <label htmlFor={inputId} className="feedback-question__label">
          {heading}
        </label>
        {description}
        {isLong ? <textarea rows={5} {...common} /> : <input type="text" {...common} />}
        {isLong && (
          <span className="feedback-question__counter" aria-hidden="true">
            {text.length} / {LONG_TEXT_MAX}
          </span>
        )}
        {errorMessage}
      </div>
    );
  }

  if (question.type === 'RATING') {
    return (
      <fieldset className={className} aria-describedby={describedBy} disabled={disabled}>
        <legend className="feedback-question__label">{heading}</legend>
        {description}
        <div className="feedback-rating">
          {RATING_VALUES.map((rating) => (
            <label key={rating} className="feedback-rating__option">
              <input
                type="radio"
                name={baseId}
                value={rating}
                checked={value === rating}
                required={question.required}
                onChange={() => onChange(rating)}
              />
              <span>{rating}</span>
            </label>
          ))}
        </div>
        {(question.config?.minLabel || question.config?.maxLabel) && (
          <div className="feedback-rating__labels">
            <span>{question.config?.minLabel && `1 = ${question.config.minLabel}`}</span>
            <span>{question.config?.maxLabel && `5 = ${question.config.maxLabel}`}</span>
          </div>
        )}
        {errorMessage}
      </fieldset>
    );
  }

  const isMulti = question.type === 'MULTI_CHOICE';
  const selected = isMulti
    ? new Set(Array.isArray(value) ? value : [])
    : new Set(typeof value === 'string' ? [value] : []);

  const toggle = (optionId: string, checked: boolean) => {
    if (!isMulti) {
      onChange(optionId);
      return;
    }
    // Keep the options' order
    const next = (question.options ?? [])
      .map((o) => o.id)
      .filter((id) => (id === optionId ? checked : selected.has(id)));
    onChange(next);
  };

  return (
    <fieldset className={className} aria-describedby={describedBy} disabled={disabled}>
      <legend className="feedback-question__label">{heading}</legend>
      {description}
      {isMulti && <p className="feedback-question__hint">Select all that apply.</p>}
      <div className="feedback-choices">
        {(question.options ?? []).map((option) => (
          <label key={option.id} className="feedback-choice">
            <input
              type={isMulti ? 'checkbox' : 'radio'}
              name={baseId}
              value={option.id}
              checked={selected.has(option.id)}
              required={!isMulti && question.required}
              onChange={(e) => toggle(option.id, e.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {errorMessage}
    </fieldset>
  );
};

export default QuestionField;
