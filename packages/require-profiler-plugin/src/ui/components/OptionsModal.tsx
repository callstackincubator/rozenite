import { useState, useRef, useEffect } from 'react';

export type ProfilerOptions = {
  minChainDurationMs: number;
};

export type OptionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  options: ProfilerOptions;
  onOptionsChange: (options: ProfilerOptions) => void;
};

export const OptionsModal = ({
  isOpen,
  onClose,
  options,
  onOptionsChange,
}: OptionsModalProps) => {
  const [localOptions, setLocalOptions] = useState<ProfilerOptions>(options);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalOptions(options);
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, options]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSave = () => {
    onOptionsChange(localOptions);
    onClose();
  };

  const handleMinDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setLocalOptions((prev) => ({
      ...prev,
      minChainDurationMs: isNaN(value) ? 0 : Math.max(0, value),
    }));
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal" ref={modalRef}>
        <div className="modal-header">
          <h2 className="modal-title">Options</h2>
          <button
            className="btn btn-icon modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          <div className="option-group">
            <label className="option-label" htmlFor="min-duration">
              Skip chains shorter than (ms)
            </label>
            <p className="option-description">
              Hide require chains with total duration below this threshold.
              Useful for filtering out fast modules to focus on slow ones.
            </p>
            <input
              ref={inputRef}
              type="number"
              id="min-duration"
              className="option-input"
              value={localOptions.minChainDurationMs}
              onChange={handleMinDurationChange}
              min="0"
              step="1"
              placeholder="0"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
