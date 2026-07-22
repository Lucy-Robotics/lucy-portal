import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, children }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirm-modal">
      <div className="confirm-modal-content">
        <h2>{title}</h2>
        {children}
        <div className="modal-buttons">
          <button type="button" onClick={onClose} className="cancel-button">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="confirm-button-danger">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
