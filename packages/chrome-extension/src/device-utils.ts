export function getDeviceName(): string {
	if (typeof navigator === 'undefined' || !navigator.userAgent) {
		return 'Unknown Browser';
	}
	const ua = navigator.userAgent;
	let match: RegExpMatchArray | null;
	// Order matters: check for more specific browsers first
	if (ua.includes('Edg/')) {
		match = ua.match(/Edg\/(\d+)/);
		return match ? `Edge ${match[1]}` : 'Edge';
	}
	if (ua.includes('OPR/') || ua.includes('Opera/')) {
		match = ua.match(/(?:OPR|Opera)\/(\d+)/);
		return match ? `Opera ${match[1]}` : 'Opera';
	}
	if (ua.includes('Firefox/')) {
		match = ua.match(/Firefox\/(\d+)/);
		return match ? `Firefox ${match[1]}` : 'Firefox';
	}
	if (ua.includes('Chrome/') && !ua.includes('Chromium')) {
		match = ua.match(/Chrome\/(\d+)/);
		return match ? `Chrome ${match[1]}` : 'Chrome';
	}
	if (ua.includes('Safari/') && !ua.includes('Chrome')) {
		match = ua.match(/Version\/(\d+)/);
		return match ? `Safari ${match[1]}` : 'Safari';
	}
	// Fallback: try to extract first known browser name
	if (ua.includes('Chrome')) return 'Chrome';
	if (ua.includes('Firefox')) return 'Firefox';
	if (ua.includes('Safari')) return 'Safari';
	return 'Unknown Browser';
}
