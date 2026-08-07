import React from 'react';
import type { BlogPost, BlogPostInput } from '../types/blog';
import BlogForm from './BlogForm';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import '../styles/blog-modal.css';

interface BlogModalProps {
  isOpen: boolean;
  post: BlogPost | null;
  onSave: (post: BlogPostInput) => void;
  onClose: () => void;
}

const BlogModal: React.FC<BlogModalProps> = ({ isOpen, post, onSave, onClose }) => {
  const { titleId, overlayProps, dialogProps } = useAccessibleDialog({
    isOpen,
    onClose,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="blog-modal-overlay" {...overlayProps}>
      <div className="blog-modal-content" {...dialogProps}>
        <BlogForm
          post={post}
          titleId={titleId}
          onSave={onSave}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

export default BlogModal;
