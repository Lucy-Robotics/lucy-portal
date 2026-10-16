import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function SortableItem({
  id,
  children,
  disabled = false,
  className = '',
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`sortable-item ${className}`.trim()}
    >
      {!disabled && (
        <button
          type="button"
          className="drag-handle"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          ⋮⋮
        </button>
      )}
      <div className="sortable-item__content">{children}</div>
    </li>
  );
}
