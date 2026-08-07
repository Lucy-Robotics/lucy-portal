import React from 'react';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
}) => {
  const { titleId, overlayProps, dialogProps } = useAccessibleDialog({
    isOpen,
    onClose,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirm-modal" {...overlayProps}>
      <div className="confirm-modal-content" {...dialogProps}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="modal-buttons">
          <button type="button" onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="confirm-button-danger"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
