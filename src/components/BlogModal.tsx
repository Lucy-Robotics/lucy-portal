import React from 'react';
import type { BlogPost, BlogPostInput } from '../types/blog';
import BlogForm from './BlogForm';
import '../styles/blog-modal.css';

interface BlogModalProps {
  isOpen: boolean;
  post: BlogPost | null;
  onSave: (post: BlogPostInput) => void;
  onClose: () => void;
}

const BlogModal: React.FC<BlogModalProps> = ({ isOpen, post, onSave, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="blog-modal-overlay" onClick={onClose}>
      <div className="blog-modal-content" onClick={(e) => e.stopPropagation()}>
        <BlogForm post={post} onSave={onSave} onClose={onClose} />
      </div>
    </div>
  );
};

export default BlogModal;
