/**
 * Injected into Rozenite-enabled pages via chrome.scripting.executeScript.
 * Must run in ISOLATED world so chrome.storage.local is available for dismiss.
 * Self-contained: no imports, all styles inline.
 *
 * Layout: bottom-left corner, single panel with logo on the left.
 */
export function injectUpdateBanner(
  latestVersion: string,
  releasesUrl: string,
  logoUrl: string,
  dismissStorageKey: string,
  dismissDurationMs: number,
): void {
  if (document.getElementById('rozenite-update-banner')) return;

  const panel = document.createElement('div');
  panel.id = 'rozenite-update-banner';
  panel.style.cssText = `
		position: fixed;
		bottom: 20px;
		left: 20px;
		z-index: 2147483647;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		background: #111111;
		border: 1px solid #313131;
		border-radius: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
		font-size: 13px;
		color: #ffffff;
		-webkit-font-smoothing: antialiased;
	`;

  const logoImg = document.createElement('img');
  logoImg.src = logoUrl;
  logoImg.alt = 'Rozenite';
  logoImg.style.cssText = `
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		object-fit: cover;
		border-radius: 0;
		image-rendering: pixelated;
	`;

  const text = document.createElement('span');
  text.textContent = `Update available — v${latestVersion}`;
  text.style.cssText = 'font-weight: 500; white-space: nowrap;';

  const downloadBtn = document.createElement('a');
  downloadBtn.href = releasesUrl;
  downloadBtn.target = '_blank';
  downloadBtn.rel = 'noopener noreferrer';
  downloadBtn.textContent = 'Download';
  downloadBtn.style.cssText = `
		display: inline-flex;
		align-items: center;
		padding: 6px 12px;
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #0a0a0a;
		background: #ff4f7b;
		border: none;
		border-radius: 0;
		cursor: pointer;
		text-decoration: none;
		transition: background 120ms ease;
		white-space: nowrap;
	`;
  downloadBtn.addEventListener('mouseenter', () => {
    downloadBtn.style.background = '#ff9fb2';
  });
  downloadBtn.addEventListener('mouseleave', () => {
    downloadBtn.style.background = '#ff4f7b';
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.innerHTML = '&times;';
  dismissBtn.type = 'button';
  dismissBtn.style.cssText = `
		background: none;
		border: none;
		color: #a3a3a3;
		cursor: pointer;
		font-size: 20px;
		line-height: 1;
		padding: 0 4px;
		transition: color 150ms ease;
		flex-shrink: 0;
	`;
  dismissBtn.addEventListener('mouseenter', () => {
    dismissBtn.style.color = '#ffffff';
  });
  dismissBtn.addEventListener('mouseleave', () => {
    dismissBtn.style.color = '#a3a3a3';
  });

  panel.append(logoImg, text, downloadBtn, dismissBtn);
  document.body.appendChild(panel);

  dismissBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      [dismissStorageKey]: Date.now() + dismissDurationMs,
    });
    panel.remove();
  });
}
