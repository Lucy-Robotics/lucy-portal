import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { BlogPost, BlogPostInput } from '../types/blog';
import '../styles/blog-form.css';

interface BlogFormProps {
  post: BlogPost | null;
  onSave: (post: BlogPostInput) => void;
  onClose: () => void;
}

const TiptapToolbar: React.FC<{ editor: Editor }> = ({ editor }) => {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
    }),
  });

  return (
    <div className="tiptap-toolbar" role="toolbar" aria-label="Text formatting">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={active.bold ? 'is-active' : ''}
        title="Bold"
      >
        <b>B</b>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={active.italic ? 'is-active' : ''}
        title="Italic"
      >
        <i>I</i>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={active.underline ? 'is-active' : ''}
        title="Underline"
      >
        <u>U</u>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={active.strike ? 'is-active' : ''}
        title="Strikethrough"
      >
        S
      </button>
      <span className="toolbar-divider" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={active.h1 ? 'is-active' : ''}
        title="Heading 1"
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={active.h2 ? 'is-active' : ''}
        title="Heading 2"
      >
        H2
      </button>
      <span className="toolbar-divider" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={active.bulletList ? 'is-active' : ''}
        title="Bullet list"
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={active.orderedList ? 'is-active' : ''}
        title="Numbered list"
      >
        1. List
      </button>
    </div>
  );
};

const BlogForm: React.FC<BlogFormProps> = ({ post, onSave, onClose }) => {
  const [formData, setFormData] = useState<BlogPostInput>({
    title: post?.title || '',
    body: post?.body || '',
    tags: post?.tags || [],
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
        },
      }),
    ],
    content: post?.body || '',
    onUpdate: ({ editor: updatedEditor }) => {
      setFormData((prev) => ({ ...prev, body: updatedEditor.getHTML() }));
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  // Only reset when the edited post (or editor instance) changes — never sync
  // body back into TipTap on every keystroke (that resets marks / forces bold).
  useEffect(() => {
    setFormData({
      title: post?.title || '',
      body: post?.body || '',
      tags: post?.tags || [],
    });

    if (!editor) return;

    const nextBody = post?.body || '';
    if (editor.getHTML() !== nextBody) {
      editor.commands.setContent(nextBody, { emitUpdate: false });
    }
  }, [post?.id, editor]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="blog-form-container">
      <form onSubmit={handleSubmit}>
        <h2>{post ? 'Edit' : 'Create'} Blog Post</h2>
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
          <span className="field-label">Body:</span>
          <div className="editor-container">
            {editor && <TiptapToolbar editor={editor} />}
            <EditorContent editor={editor} />
          </div>
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
          <button type="submit">Save</button>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
        </div>
      </form>
    </div>
  );
};

export default BlogForm;
