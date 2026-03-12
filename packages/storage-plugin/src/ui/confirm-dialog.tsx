import { X, AlertTriangle, Info } from 'lucide-react';

export type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'confirm' | 'alert';
  confirmText?: string;
  cancelText?: string;
};

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}: ConfirmDialogProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      onConfirm();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleCancel}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {type === 'confirm' ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : (
              <Info className="h-5 w-5 text-blue-500" />
            )}
            <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-300 leading-relaxed">{message}</p>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2">
          {type === 'confirm' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm text-white rounded transition-colors ${
              type === 'confirm'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            autoFocus
          >
            {type === 'alert' ? 'OK' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
