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
	dismissDurationMs: number
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
		background: rgba(26, 26, 26, 0.95);
		border: 1px solid rgba(61, 61, 61, 0.8);
		border-radius: 12px;
		box-shadow: 0 4px 24px rgba(0,0,0,0.4);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
		font-size: 13px;
		color: #e6e6e6;
		-webkit-font-smoothing: antialiased;
		backdrop-filter: blur(8px);
	`;

	const logoImg = document.createElement('img');
	logoImg.src = logoUrl;
	logoImg.alt = 'Rozenite';
	logoImg.style.cssText = `
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		object-fit: cover;
		border-radius: 50%;
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
		font-size: 12px;
		font-weight: 600;
		color: #fff;
		background: #8232FF;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		text-decoration: none;
		transition: background 150ms ease;
		white-space: nowrap;
	`;
	downloadBtn.addEventListener('mouseenter', () => {
		downloadBtn.style.background = '#9a5aff';
	});
	downloadBtn.addEventListener('mouseleave', () => {
		downloadBtn.style.background = '#8232FF';
	});

	const dismissBtn = document.createElement('button');
	dismissBtn.innerHTML = '&times;';
	dismissBtn.type = 'button';
	dismissBtn.style.cssText = `
		background: none;
		border: none;
		color: #8a8a8a;
		cursor: pointer;
		font-size: 20px;
		line-height: 1;
		padding: 0 4px;
		transition: color 150ms ease;
		flex-shrink: 0;
	`;
	dismissBtn.addEventListener('mouseenter', () => {
		dismissBtn.style.color = '#e6e6e6';
	});
	dismissBtn.addEventListener('mouseleave', () => {
		dismissBtn.style.color = '#8a8a8a';
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
