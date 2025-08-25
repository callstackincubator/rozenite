import React, { useState } from 'react';
import './modal.css';

interface AddEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (key: string, value: string) => void;
  existingKeys: string[];
}

export function AddEntryModal({ isOpen, onClose, onAdd, existingKeys }: AddEntryModalProps) {
  const [key, setKey] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const [keyError, setKeyError] = useState<string>('');
  const [valueError, setValueError] = useState<string>('');

  if (!isOpen) return null;

  const validateKey = (key: string) => {
    if (!key.trim()) {
      setKeyError('Key cannot be empty');
      return false;
    }
    
    if (existingKeys.includes(key)) {
      setKeyError('Key already exists');
      return false;
    }
    
    setKeyError('');
    return true;
  };

  const validateValue = (value: string) => {
    // Value can be empty, but we should warn
    if (!value.trim()) {
      setValueError('Warning: Empty value will be stored as empty string');
      // Still return true as this is just a warning
      return true;
    }
    
    setValueError('');
    return true;
  };

  const handleAdd = () => {
    const isKeyValid = validateKey(key);
    const isValueValid = validateValue(value);
    
    if (isKeyValid && isValueValid) {
      onAdd(key, value);
      setKey('');
      setValue('');
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Add New Entry</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Key</label>
            <input
              className="form-control"
              type="text"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                validateKey(e.target.value);
              }}
              placeholder="Enter key name"
            />
            {keyError && <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem' }}>{keyError}</div>}
          </div>
          
          <div className="form-group">
            <label className="form-label">Value</label>
            <textarea
              className="form-control form-textarea"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                validateValue(e.target.value);
              }}
              placeholder="Enter value (strings, numbers, JSON objects, etc.)"
            />
            {valueError && <div style={{ color: '#f59e0b', fontSize: '0.75rem', marginTop: '0.25rem' }}>{valueError}</div>}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd}>Add</button>
        </div>
      </div>
    </div>
  );
}
