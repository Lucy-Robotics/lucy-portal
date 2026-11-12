import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { BlogPost } from '../types/blog';
import { getBlogPost } from '../lib/api';
import { isBackendConfigured } from '../config/env';
import Markdown from '../components/Markdown';
import '../styles/blog.css';

const BlogPostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !isBackendConfigured) return;

    const fetchPost = async () => {
      try {
        setLoading(true);
        const data = await getBlogPost(id);
        setPost(data);
        setError(null);
      } catch (err) {
        setError('Failed to load blog post.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  if (loading) {
    return <div className="blog-page-container">Loading...</div>;
  }

  if (error || !post) {
    return (
      <div className="blog-page-container">
        <p className="error-message">{error || 'Post not found.'}</p>
        <Link to="/blog">Back to blog</Link>
      </div>
    );
  }

  return (
    <div className="blog-page-container">
      <Link to="/blog" className="back-link">
        ← Back to blog
      </Link>
      <article className="chamfer blog-post-detail">
        <header className="card-header">
          <h1 className="title">{post.title}</h1>
          <div className="post-meta">
            <span className="author">{post.author}</span>
            <span className="date">{new Date(post.date).toLocaleDateString()}</span>
          </div>
        </header>
        <div className="post-body">
          <Markdown>{post.body}</Markdown>
        </div>
        <div className="post-tags">
          {post.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </article>
    </div>
  );
};

export default BlogPostDetail;
