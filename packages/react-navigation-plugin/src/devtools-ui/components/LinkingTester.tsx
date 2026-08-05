import { useState } from 'react';

export type LinkingTesterProps = {
  onLinkOpen: (url: string) => void;
};

export const LinkingTester = ({ onLinkOpen }: LinkingTesterProps) => {
  const [url, setUrl] = useState('');
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  const handleOpenLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!url.trim()) {
      return;
    }

    setLastOpened(url.trim());
    onLinkOpen(url.trim());
  };

  return (
    <div className="h-full bg-gray-900 p-6 overflow-auto">
      <div className="max-w-2xl">
        <div className="space-y-4">
          {/* URL Input */}
          <form onSubmit={handleOpenLink} className="flex gap-2">
            <input
              id="url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="myapp://screen/param"
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!url.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Open
            </button>
          </form>

          {/* Last Opened */}
          {lastOpened && (
            <div className="p-3 bg-gray-800 rounded border border-gray-700">
              <p className="text-sm text-gray-300">
                <span className="text-green-400">Last opened:</span>{' '}
                {lastOpened}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
