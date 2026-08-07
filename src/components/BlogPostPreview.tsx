import React from 'react';
import { Link } from 'react-router-dom';
import type { BlogPost } from '../types/blog';
import '../styles/blog.css';

interface BlogPostPreviewProps {
  post: BlogPost;
  isAuthenticated?: boolean;
  onEdit?: (post: BlogPost) => void;
  onDelete?: (id: string) => void;
}

const createSnippet = (html: string, length = 100) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent || div.innerText || '').trim();
  return text.length > length ? `${text.substring(0, length)}...` : text;
};

const BlogPostPreview: React.FC<BlogPostPreviewProps> = ({
  post,
  isAuthenticated = false,
  onEdit,
  onDelete,
}) => {
  return (
    <article className="blog-post-item">
      <div className="card-header">
        <Link to={`/blog/${post.id}`} className="title-link">
          <h2 className="title">{post.title}</h2>
        </Link>
        <div className="post-meta">
          <span className="author">{post.author}</span>
          <span className="date">{new Date(post.date).toLocaleDateString()}</span>
        </div>
      </div>
      <p className="blog-post-item-preview">{createSnippet(post.body, 100)}</p>
      <div className="post-tags">
        {post.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
      {isAuthenticated && (
        <div className="admin-controls">
          <button type="button" onClick={() => onEdit?.(post)}>
            Edit
          </button>
          <button type="button" onClick={() => onDelete?.(post.id)}>
            Delete
          </button>
        </div>
      )}
    </article>
  );
};

export default BlogPostPreview;
