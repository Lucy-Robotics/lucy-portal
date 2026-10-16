import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { TimelineItem } from '../types/timeline';
import { useAuth } from '../providers/AuthProvider';
import RoadmapForm from '../components/RoadmapForm';
import { SortableItem } from '../components/SortableItem';
import ConfirmModal from '../components/ConfirmModal';
import {
  getRoadmapItems,
  createRoadmapItem,
  updateRoadmapItem,
  deleteRoadmapItem,
} from '../lib/api';
import { isBackendConfigured } from '../config/env';
import '../styles/roadmap.css';
import '../styles/roadmap-form.css';
import '../styles/confirm-modal.css';

const Roadmap: React.FC = () => {
  const { isAuthenticated, accessToken } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TimelineItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDeleteId, setItemToDeleteId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await getRoadmapItems();
      setItems(data.sort((a, b) => a.position - b.position));
      setError(null);
    } catch (err) {
      setError('Failed to fetch roadmap items.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isBackendConfigured) fetchItems();
  }, []);

  const persistOrder = async (reorderedItems: TimelineItem[]) => {
    if (!accessToken) return;

    try {
      await Promise.all(
        reorderedItems.map((item) => {
          const { id, ...rest } = item;
          return updateRoadmapItem(id, rest, accessToken);
        })
      );
    } catch (err) {
      setError('Failed to update item positions.');
      console.error(err);
      await fetchItems();
    }
  };

  const applyReorder = async (reorderedItems: TimelineItem[]) => {
    const withPositions = reorderedItems.map((item, index) => ({
      ...item,
      position: index + 1,
    }));
    setItems(withPositions);
    await persistOrder(withPositions);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    await applyReorder(arrayMove(items, oldIndex, newIndex));
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    await applyReorder(arrayMove(items, index, newIndex));
  };

  const handleCreate = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item: TimelineItem) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDeleteId && accessToken) {
      try {
        await deleteRoadmapItem(itemToDeleteId, accessToken);
        await fetchItems();
      } catch (err) {
        setError('Failed to delete item.');
        console.error(err);
      } finally {
        setItemToDeleteId(null);
        setIsDeleteModalOpen(false);
      }
    }
  };

  const handleCancelDelete = () => {
    setItemToDeleteId(null);
    setIsDeleteModalOpen(false);
  };

  const handleSave = async (item: TimelineItem) => {
    if (!accessToken) return;

    const { id, ...itemData } = item;

    try {
      if (selectedItem) {
        await updateRoadmapItem(selectedItem.id, itemData, accessToken);
      } else {
        const newPosition = Math.max(...items.map((i) => i.position), 0) + 1;
        await createRoadmapItem({ ...itemData, position: newPosition }, accessToken);
      }
      await fetchItems();
      setIsFormOpen(false);
      setSelectedItem(null);
    } catch (err) {
      setError(selectedItem ? 'Failed to update item.' : 'Failed to create item.');
      console.error(err);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedItem(null);
  };

  if (loading) {
    return (
      <div className="roadmap-page-container" role="status" aria-live="polite">
        Loading...
      </div>
    );
  }

  return (
    <div className="roadmap-page-container">
      {isFormOpen && (
        <RoadmapForm item={selectedItem} onSave={handleSave} onClose={handleCloseForm} />
      )}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
      >
        <p>Are you sure you want to delete this item?</p>
      </ConfirmModal>

      <header className="page-header">
        <h1 className="page-title"><span className="page-title__accent" aria-hidden="true">&gt;</span> Roadmap</h1>
        <p className="page-subtitle">
          A quick overview of what we have planned. For more detail, visit our{' '}
          <a
            className="link"
            target="_blank"
            rel="noreferrer"
            href="https://projects.sentience-robotics.fr/"
          >
            Open Project
          </a>{' '}
          boards.
        </p>
      </header>

      {error && (
        <div className="error-message" role="alert" style={{ color: 'red' }}>
          {error}
        </div>
      )}

      {isAuthenticated && (
        <div className="roadmap-toolbar">
          <button
            type="button"
            className="roadmap-create-btn"
            onClick={handleCreate}
            disabled={!isBackendConfigured}
          >
            Create item
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="timeline-list" aria-label="Project roadmap">
            {items.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === items.length - 1;
              const done = item.done ?? true;
              const statusLabel = done ? 'Shipped' : 'Soon';

              return (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  disabled={!isAuthenticated}
                  className={`timeline-item ${done ? '' : 'italic'}`}
                >
                    <div className="date-label">{statusLabel}</div>

                    <div className="checkbox-container">
                      <span
                        className={`status-marker ${done ? 'status-marker--done' : 'status-marker--soon'}`}
                        role="img"
                        aria-label={`Status: ${statusLabel}`}
                      />
                      <div
                        className={`line-container ${isFirst ? 'justify-end' : ''}`}
                        aria-hidden="true"
                      >
                        <div
                          className={`line ${isFirst ? 'rounded-t-full' : ''} ${isLast ? 'rounded-b-full' : ''} ${
                            isFirst || isLast ? 'h-half' : 'h-full'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="chamfer card">
                      <div className="card-body">
                        <div className="card-content">
                          <div className="card-header">
                            <div className="header-left">
                              <span
                                className={`title ${done ? '' : 'text-secondary italic'}`}
                              >
                                {item.title}
                              </span>
                            </div>
                            <div className="header-right">
                              {item?.link?.text && item?.link?.href && (
                                <a href={item.link.href} className="link">
                                  [{item.link.text}]
                                </a>
                              )}
                            </div>
                          </div>
                          <p className="description">{item.description}</p>
                          {isAuthenticated && (
                            <div className="admin-controls">
                              <button
                                type="button"
                                onClick={() => moveItem(index, -1)}
                                disabled={isFirst}
                                aria-label={`Move ${item.title} up`}
                              >
                                Move up
                              </button>
                              <button
                                type="button"
                                onClick={() => moveItem(index, 1)}
                                disabled={isLast}
                                aria-label={`Move ${item.title} down`}
                              >
                                Move down
                              </button>
                              <button type="button" onClick={() => handleEdit(item)}>
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(item.id)}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                </SortableItem>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default Roadmap;
