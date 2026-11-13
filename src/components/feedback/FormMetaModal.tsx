import React, { useState } from 'react';
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog';
import { STATUS_LABELS, type FeedbackForm, type FormInput } from '../../types/feedback';
import '../../styles/roadmap-form.css';

interface FormMetaModalProps {
  form: FeedbackForm | null;
  error?: string | null;
  onSave: (input: FormInput) => void;
  onClose: () => void;
}

const FormMetaModal: React.FC<FormMetaModalProps> = ({ form, error, onSave, onClose }) => {
  const [formData, setFormData] = useState<FormInput>({
    title: form?.title ?? '',
    slug: form?.slug ?? '',
    description: form?.description ?? '',
    status: form?.status ?? 'DRAFT',
    allowMultipleResponses: form?.allowMultipleResponses ?? false,
  });
  const { titleId, overlayProps, dialogProps } = useAccessibleDialog({
    isOpen: true,
    onClose,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, slug: formData.slug?.trim() || undefined });
  };

  return (
    <div className="roadmap-modal-overlay" {...overlayProps}>
      <div className="chamfer roadmap-modal-content" {...dialogProps}>
        <form className="roadmap-form roadmap-modal-body" onSubmit={handleSubmit}>
          <h2 id={titleId}>{form ? 'Edit form' : 'Create form'}</h2>
          <label>
            Title
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              maxLength={191}
              required
            />
          </label>
          <label>
            URL slug
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              maxLength={60}
              placeholder="Generated from the title"
              aria-describedby={`${titleId}-slug-hint`}
            />
            <small id={`${titleId}-slug-hint`} className="feedback-field-hint">
              The form is shared at /feedback/your-slug.
            </small>
          </label>
          <label>
            Description
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              maxLength={5000}
            />
          </label>
          <label>
            Status
            <select name="status" value={formData.status} onChange={handleChange}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.allowMultipleResponses}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, allowMultipleResponses: e.target.checked }))
              }
              aria-describedby={`${titleId}-multiple-hint`}
            />
            Allow multiple answers per person
          </label>
          <small id={`${titleId}-multiple-hint`} className="feedback-field-hint">
            When off, someone who already answered sees their answers instead of the form.
            This is checked in their browser only, so it can be bypassed.
          </small>
          {error && (
            <p className="error-message" role="alert">
              {error}
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

export default FormMetaModal;
