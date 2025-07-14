import { useEffect, useState } from 'react';
import { callstackDevtoolsApi } from '@rozenite/devtools-core/guest';

import './panel.css';

export const Panel = () => {
  const [plugins, setPlugins] = useState<any[]>([]);

  useEffect(() => {
    callstackDevtoolsApi.getPlugins().then((plugins) => {
      setPlugins(plugins);
    });
  }, []);

  const handlePluginClick = (website: string) => {
    window.open(website, '_blank');
  };

  return (
    <div className="container">
      <div className="header">
        <div className="header-background"></div>
        <div className="header-content">
          <div className="header-text">
            <h1 className="title">Plugins Dashboard</h1>
            <p className="subtitle">
              Explore and manage your development plugins
            </p>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="plugins-grid">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="plugin-card"
              onClick={() => handlePluginClick(plugin.website)}
            >
              <div className="card-header">
                <div className="card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 22V12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 17L12 12L2 17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 7L12 12L22 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <h3 className="plugin-name">{plugin.name}</h3>
              <div className="plugin-id">{plugin.id}</div>
              <p className="plugin-description">{plugin.description}</p>

              <div className="card-footer">
                <div className="link-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 17L17 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 7H17V17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
