import React, { useState, useEffect } from 'react';
import './modal.css';
import { AsyncStorageEntry } from '../shared/types';

interface EditModalProps {
  isOpen: boolean;
  entry: AsyncStorageEntry | null;
  onClose: () => void;
  onSave: (key: string, value: string) => void;
  onDelete: (key: string) => void;
}

export function EditModal({ isOpen, entry, onClose, onSave, onDelete }: EditModalProps) {
  const [editValue, setEditValue] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (entry) {
      setEditValue(entry.value);
      setError('');
    }
  }, [entry]);

  if (!isOpen || !entry) return null;

  const handleSave = () => {
    try {
      // For object/array types, validate JSON
      if (entry.type === 'object' || entry.type === 'array') {
        JSON.parse(editValue);
      }
      
      onSave(entry.key, editValue);
      onClose();
    } catch (e) {
      setError('Invalid JSON format');
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete "${entry.key}"?`)) {
      onDelete(entry.key);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Edit Value</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Key</label>
            <input
              className="form-control"
              type="text"
              value={entry.key}
              disabled
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Type</label>
            <input
              className="form-control"
              type="text"
              value={entry.type}
              disabled
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Value</label>
            <textarea
              className="form-control form-textarea"
              value={editValue}
              onChange={(e) => {
                setEditValue(e.target.value);
                setError('');
              }}
            />
            {error && <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>{error}</div>}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
