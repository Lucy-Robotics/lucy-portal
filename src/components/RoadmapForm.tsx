import React, { useState, useEffect } from 'react';
import type { TimelineItem } from '../types/timeline';
import '../styles/roadmap-form.css';

interface RoadmapFormProps {
  item: TimelineItem | null;
  onSave: (item: TimelineItem) => void;
  onClose: () => void;
}

const RoadmapForm: React.FC<RoadmapFormProps> = ({ item, onSave, onClose }) => {
  const [formData, setFormData] = useState<TimelineItem>(
    item || {
      id: '',
      position: 0,
      title: '',
      description: '',
      done: false,
      link: { href: '', text: '' },
    }
  );

  useEffect(() => {
    if (item) {
      setFormData(item);
    }
  }, [item]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      link: { ...prev.link, [name]: value },
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="roadmap-form-modal">
      <div className="roadmap-form-content">
        <form onSubmit={handleSubmit}>
          <h2>{item ? 'Edit' : 'Create'} Roadmap Item</h2>
          <label>
            Title:
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Description:
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Link URL:
            <input
              type="text"
              name="href"
              value={formData.link?.href || ''}
              onChange={handleLinkChange}
            />
          </label>
          <label>
            Link Text:
            <input
              type="text"
              name="text"
              value={formData.link?.text || ''}
              onChange={handleLinkChange}
            />
          </label>
          <label>
            Done:
            <input
              type="checkbox"
              name="done"
              checked={formData.done}
              onChange={handleCheckboxChange}
            />
          </label>
          <div className="form-buttons">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RoadmapForm;
