import React, { useState, useEffect, useId } from 'react';
import Markdown from './Markdown';
import type { BlogPost, BlogPostInput } from '../types/blog';
import '../styles/blog-form.css';

interface BlogFormProps {
  post: BlogPost | null;
  titleId?: string;
  onSave: (post: BlogPostInput) => Promise<boolean>;
  onClose: () => void;
}

const draftKey = (post: BlogPost | null) => `blog-draft:${post?.id ?? 'new'}`;

const fromPost = (post: BlogPost | null): BlogPostInput => ({
  title: post?.title || '',
  body: post?.body || '',
  tags: post?.tags || [],
});

// Storage can be unavailable. Drafts are best-effort.
function loadDraft(post: BlogPost | null): BlogPostInput | null {
  try {
    const raw = localStorage.getItem(draftKey(post));
    return raw ? (JSON.parse(raw) as BlogPostInput) : null;
  } catch {
    return null;
  }
}

function storeDraft(post: BlogPost | null, data: BlogPostInput | null) {
  try {
    if (data) localStorage.setItem(draftKey(post), JSON.stringify(data));
    else localStorage.removeItem(draftKey(post));
  } catch {
    // ignore
  }
}

const BlogForm: React.FC<BlogFormProps> = ({ post, titleId, onSave, onClose }) => {
  const generatedTitleId = useId();
  const headingId = titleId ?? generatedTitleId;
  const bodyId = useId();
  const previewLabelId = useId();

  const [initialDraft] = useState(() => loadDraft(post));
  const [formData, setFormData] = useState<BlogPostInput>(initialDraft ?? fromPost(post));
  const [restoredDraft, setRestoredDraft] = useState(initialDraft !== null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unchanged = JSON.stringify(formData) === JSON.stringify(fromPost(post));
    storeDraft(post, unchanged ? null : formData);
  }, [formData, post]);

  const discardDraft = () => {
    const original = fromPost(post);
    storeDraft(post, null);
    setFormData(original);
    setRestoredDraft(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      tags: value.split(',').map((tag) => tag.trim()).filter(Boolean),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const saved = await onSave(formData);
    setSaving(false);
    if (saved) storeDraft(post, null);
  };

  return (
    <div className="blog-form-container">
      <form onSubmit={handleSubmit}>
        <h2 id={headingId}>{post ? 'Edit' : 'Create'} Blog Post</h2>
        {restoredDraft && (
          <p className="editor-trust-note" role="status">
            Restored your unsaved draft.{' '}
            <button type="button" className="secondary" onClick={discardDraft}>
              Discard draft
            </button>
          </p>
        )}
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
        <div className="body-field">
          <div className="markdown-editor">
            <label htmlFor={bodyId} className="markdown-write-label">
              Body (Markdown):
            </label>
            <textarea
              id={bodyId}
              name="body"
              value={formData.body}
              onChange={handleChange}
              spellCheck
            />
            <span className="field-label markdown-preview-label" id={previewLabelId}>
              Preview:
            </span>
            <section className="markdown-preview post-body" aria-labelledby={previewLabelId}>
              <Markdown>{formData.body}</Markdown>
            </section>
          </div>
          <p className="editor-trust-note">
            Supports GitHub-flavored Markdown, images by URL
            (<code>![alt](https://…)</code>, add <code>#no-chamfer</code> to the URL for square corners)
            and <code>```mermaid</code> diagrams.
          </p>
        </div>
        <label>
          Tags (comma-separated):
          <input
            type="text"
            name="tags"
            value={formData.tags.join(', ')}
            onChange={handleTagsChange}
          />
        </label>
        <div className="form-buttons">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default BlogForm;
