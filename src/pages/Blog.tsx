import React, { useState, useEffect } from 'react';
import type { BlogPost, BlogPostInput } from '../types/blog';
import { useAuth } from '../providers/AuthProvider';
import BlogModal from '../components/BlogModal';
import BlogPostPreview from '../components/BlogPostPreview';
import ConfirmModal from '../components/ConfirmModal';
import {
  getBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from '../lib/api';
import { isBackendConfigured } from '../config/env';
import '../styles/blog.css';
import '../styles/blog-form.css';
import '../styles/confirm-modal.css';

const Blog: React.FC = () => {
  const { isAuthenticated, accessToken } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [postToDeleteId, setPostToDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const data = await getBlogPosts();
      setPosts(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setError(null);
    } catch (err) {
      setError('Failed to fetch blog posts.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isBackendConfigured) fetchPosts();
  }, []);

  const handleCreate = () => {
    setSelectedPost(null);
    setIsFormOpen(true);
  };

  const handleEdit = (post: BlogPost) => {
    setSelectedPost(post);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setPostToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (postToDeleteId && accessToken) {
      try {
        await deleteBlogPost(postToDeleteId, accessToken);
        await fetchPosts();
      } catch (err) {
        setError('Failed to delete post.');
        console.error(err);
      } finally {
        setPostToDeleteId(null);
        setIsDeleteModalOpen(false);
      }
    }
  };

  const handleCancelDelete = () => {
    setPostToDeleteId(null);
    setIsDeleteModalOpen(false);
  };

  const handleSave = async (post: BlogPostInput) => {
    if (!accessToken) return;

    try {
      if (selectedPost) {
        await updateBlogPost(selectedPost.id, post, accessToken);
      } else {
        await createBlogPost(post, accessToken);
      }
      await fetchPosts();
      setIsFormOpen(false);
      setSelectedPost(null);
    } catch (err) {
      setError(selectedPost ? 'Failed to update post.' : 'Failed to create post.');
      console.error(err);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedPost(null);
  };

  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="blog-page-container">
      <BlogModal
        isOpen={isFormOpen}
        post={selectedPost}
        onSave={handleSave}
        onClose={handleCloseForm}
      />
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
      >
        <p>Are you sure you want to delete this post?</p>
      </ConfirmModal>

      <header className="page-header">
        <h1 className="page-title"><span className="page-title__accent" aria-hidden="true">&gt;</span> Blog</h1>
        <p className="page-subtitle blog-page-subtitle">
          Latest news and updates from the team.
        </p>
      </header>

      {error && (
        <div className="error-message" style={{ color: 'red' }}>
          {error}
        </div>
      )}

      <div className="blog-toolbar">
        <input
          type="search"
          placeholder="Search posts or tags..."
          className="search-bar"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search posts or tags"
        />
        {isAuthenticated && (
          <button
            type="button"
            className="blog-create-btn"
            onClick={handleCreate}
            disabled={!isBackendConfigured}
          >
            Create post
          </button>
        )}
      </div>

      <div className="blog-posts-list">
        {filteredPosts.map((post) => (
          <BlogPostPreview
            key={post.id}
            post={post}
            isAuthenticated={isAuthenticated}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
          />
        ))}
      </div>
    </div>
  );
};

export default Blog;
