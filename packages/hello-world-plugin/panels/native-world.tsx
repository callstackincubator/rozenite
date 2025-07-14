import { useDevToolsPluginClient } from '@rozenite/plugin-bridge';
import { useState } from 'react';

export default function NativeWorldPanel() {
  const [message, setMessage] = useState('');

  const client = useDevToolsPluginClient({
    pluginId: 'native-world',
  });

  const sendMessage = () => {
    client?.send('rn-debugger', message);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '30px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '400px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            margin: '0 0 20px 0',
            color: '#333',
            fontSize: '24px',
            fontWeight: '600',
          }}
        >
          Native World Plugin
        </h2>

        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="message-input"
            style={{
              display: 'block',
              marginBottom: '8px',
              color: '#555',
              fontSize: '14px',
              fontWeight: '500',
              textAlign: 'left',
            }}
          >
            Message to send:
          </label>
          <input
            id="message-input"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message here..."
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #e1e5e9',
              borderRadius: '8px',
              fontSize: '16px',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease',
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#007AFF';
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#e1e5e9';
            }}
          />
        </div>

        <button
          onClick={sendMessage}
          disabled={!message.trim()}
          style={{
            backgroundColor: message.trim() ? '#007AFF' : '#ccc',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: message.trim() ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.2s ease',
            width: '100%',
          }}
          onMouseEnter={(e) => {
            if (message.trim()) {
              (e.target as HTMLButtonElement).style.backgroundColor = '#0056CC';
            }
          }}
          onMouseLeave={(e) => {
            if (message.trim()) {
              (e.target as HTMLButtonElement).style.backgroundColor = '#007AFF';
            }
          }}
        >
          Send Message
        </button>
      </div>
    </div>
  );
}
