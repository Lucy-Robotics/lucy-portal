import React, { useState, useEffect, useId } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { BlogPost, BlogPostInput } from '../types/blog';
import '../styles/blog-form.css';

interface BlogFormProps {
  post: BlogPost | null;
  titleId?: string;
  onSave: (post: BlogPostInput) => void;
  onClose: () => void;
}

type ToolbarButton = {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

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

  const groups: ToolbarButton[][] = [
    [
      {
        label: 'Bold',
        pressed: active.bold,
        onClick: () => editor.chain().focus().toggleBold().run(),
        children: <b>B</b>,
      },
      {
        label: 'Italic',
        pressed: active.italic,
        onClick: () => editor.chain().focus().toggleItalic().run(),
        children: <i>I</i>,
      },
      {
        label: 'Underline',
        pressed: active.underline,
        onClick: () => editor.chain().focus().toggleUnderline().run(),
        children: <u>U</u>,
      },
      {
        label: 'Strikethrough',
        pressed: active.strike,
        onClick: () => editor.chain().focus().toggleStrike().run(),
        children: 'S',
      },
    ],
    [
      {
        label: 'Heading 1',
        pressed: active.h1,
        onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        children: 'H1',
      },
      {
        label: 'Heading 2',
        pressed: active.h2,
        onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        children: 'H2',
      },
    ],
    [
      {
        label: 'Bullet list',
        pressed: active.bulletList,
        onClick: () => editor.chain().focus().toggleBulletList().run(),
        children: '• List',
      },
      {
        label: 'Numbered list',
        pressed: active.orderedList,
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
        children: '1. List',
      },
    ],
  ];

  return (
    <div className="tiptap-toolbar" role="toolbar" aria-label="Text formatting">
      {groups.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          {groupIndex > 0 ? (
            <span className="toolbar-divider" aria-hidden="true" />
          ) : null}
          {group.map((button) => (
            <button
              key={button.label}
              type="button"
              onClick={button.onClick}
              className={button.pressed ? 'is-active' : ''}
              title={button.label}
              aria-label={button.label}
              aria-pressed={button.pressed}
            >
              {button.children}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

const BlogForm: React.FC<BlogFormProps> = ({ post, titleId, onSave, onClose }) => {
  const generatedTitleId = useId();
  const headingId = titleId ?? generatedTitleId;
  const bodyLabelId = useId();

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
        'aria-labelledby': bodyLabelId,
      },
    },
  });

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
        <h2 id={headingId}>{post ? 'Edit' : 'Create'} Blog Post</h2>
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
          <span className="field-label" id={bodyLabelId}>
            Body:
          </span>
          <div className="editor-container">
            {editor && <TiptapToolbar editor={editor} />}
            <EditorContent editor={editor} />
          </div>
          <p className="editor-trust-note">
            Content is authored by administrators and rendered as HTML on the
            public blog.
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
