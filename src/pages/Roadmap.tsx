import React, { useState } from 'react';
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
import '../styles/roadmap.css';
import '../styles/roadmap-form.css';
import '../styles/confirm-modal.css';

const mockItems: TimelineItem[] = [
    {
        id: crypto.randomUUID(),
        position: 1,
        title: 'Project Kick-off',
        description: 'Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!',
        done: true,
    },
    {
        id: crypto.randomUUID(),
        position: 2,
        title: 'First Mockups',
        description: 'Designing.',
        done: true,
    },
    {
        id: crypto.randomUUID(),
        position: 3,
        title: 'Alpha Release',
        description: 'FiInitial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!rst functional version for internal testing.',
        done: false,
        link: { href: '#', text: 'Changelog' },
    },
    {
        id: crypto.randomUUID(),
        position: 4,
        title: 'Public Beta',
        description: 'Feature-complete version for public feedback.',
        done: false,
    },
];

const Roadmap: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<TimelineItem[]>(mockItems.sort((a,b)=> a.position - b.position));
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((currentItems) => {
        const oldIndex = currentItems.findIndex((item) => item.id === active.id);
        const newIndex = currentItems.findIndex((item) => item.id === over.id);
        const reorderedItems = arrayMove(currentItems, oldIndex, newIndex);
        return reorderedItems.map((item, index) => ({ ...item, position: index + 1 }));
      });
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

  const handleConfirmDelete = () => {
    if (itemToDeleteId) {
      setItems(prev => prev.filter((i) => i.id !== itemToDeleteId).map((item, index) => ({ ...item, position: index + 1 })));
      setItemToDeleteId(null);
      setIsDeleteModalOpen(false);
    }
  };

    const handleCancelDelete = () => {
        setItemToDeleteId(null);
        setIsDeleteModalOpen(false);
    };

  const handleSave = (item: TimelineItem) => {
    let newItems;
    if (selectedItem) {
      newItems = items.map((i) => (i.id === item.id ? item : i));
    } else {
      const newPosition = Math.max(...items.map(i => i.position), 0) + 1;
      newItems = [...items, { ...item, id: crypto.randomUUID(), position: newPosition }];
    }
    setItems(newItems.sort((a, b) => a.position - b.position));
    setIsFormOpen(false);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedItem(null);
  };
  return (
    <div className="roadmap-page-container">
      <h1>Roadmap</h1>
      {isAuthenticated && <button onClick={handleCreate}>Create New Item</button>}
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
                              {item.link && (
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
