import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
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
import '../styles/roadmap.css';
import '../styles/roadmap-form.css';
import '../styles/confirm-modal.css';

const Roadmap: React.FC = () => {
  const { isAuthenticated, accessToken } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    fetchItems();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const reorderedItems = arrayMove(items, oldIndex, newIndex).map(
        (item, index) => ({ ...item, position: index + 1 })
      );
      setItems(reorderedItems);

      if (accessToken) {
        try {
          await Promise.all(
            reorderedItems.map((item) => {
                const { id, ...rest } = item;
                return updateRoadmapItem(id, rest, accessToken)
            })
          );
        } catch (err) {
          setError('Failed to update item positions.');
          console.error(err);
          // Optionally refetch to revert to server state
          await fetchItems();
        }
      }
    }
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
            const newPosition = Math.max(...items.map(i => i.position), 0) + 1;
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
    return <div>Loading...</div>;
  }

  return (
    <div className="roadmap-page-container">
      <h1>Roadmap</h1>
      <h2>Get a quick overview of our roadmap and see what we have planned for the future.</h2>
      <h2>To see a more detailed roadmap, please visit our <a className="link" target="_blank" href="/https://projects.sentience-robotics.fr/">Open Project</a> boards.</h2>
      {error && <div className="error-message" style={{ color: 'red' }}>{error}</div>}
      {isAuthenticated && <button className="create-button" onClick={handleCreate}>Create New Item</button>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="timeline-list">
            {items.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === items.length - 1;
              const done = item.done ?? true;

              return (
                <SortableItem key={item.id} id={item.id}>
                  <li className={`timeline-item ${done ? '' : 'italic'}`}>
                    <div className="date-label">{done ? 'Shipped' : 'Soon'}</div>

                    <div className="checkbox-container">
                      <input type="checkbox" checked={done} readOnly className="checkbox" />
                      <div className={`line-container ${isFirst ? 'justify-end' : ''}`}>
                        <div
                          className={`line ${isFirst ? 'rounded-t-full' : ''} ${isLast ? 'rounded-b-full' : ''} ${
                            isFirst || isLast ? 'h-half' : 'h-full'
                          }`}
                        ></div>
                      </div>
                    </div>

                    <div className={`card ${isLast ? '' : ''}`}>
                      <div className="card-body">
                        <div className="card-content">
                          <div className="card-header">
                            <div className="header-left">
                              <span className={`title ${done ? '' : 'text-secondary italic'}`}>{item.title}</span>
                            </div>
                            <div className="header-right">
                              {(item?.link?.text && item?.link?.href) && (
                                <a href={item.link.href} className="link">
                                  [{item.link.text}]
                                </a>
                              )}
                            </div>
                          </div>
                          <p className="description">{item.description}</p>
                          {isAuthenticated && (
                            <div className="admin-controls">
                              <button onClick={() => handleEdit(item)}>Edit</button>
                              <button onClick={() => handleDeleteClick(item.id)}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                </SortableItem>
              );
            })}
          </ul>
        </SortableContext>
      </DndContext>
      {isFormOpen && <RoadmapForm item={selectedItem} onSave={handleSave} onClose={handleCloseForm} />}
        <ConfirmModal
            isOpen={isDeleteModalOpen}
            onClose={handleCancelDelete}
            onConfirm={handleConfirmDelete}
            title="Confirm Deletion"
        >
            <p>Are you sure you want to delete this item?</p>
        </ConfirmModal>
    </div>
  );
};

export default Roadmap;
