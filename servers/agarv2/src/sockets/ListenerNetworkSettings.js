'use strict';

function parseBoolean(value, fallback) {
	if (typeof value !== 'string') return fallback;
	if (/^(1|true|yes|on)$/i.test(value)) return true;
	if (/^(0|false|no|off)$/i.test(value)) return false;
	return fallback;
}

function parseList(value, fallback) {
	if (typeof value !== 'string') return fallback;
	return value.split(',').map(item => item.trim()).filter(Boolean);
}

function getListenerNetworkSettings(settings) {
	const configuredProxies = Array.isArray(settings.listenerTrustedProxies)
		? settings.listenerTrustedProxies
		: ['127.0.0.1', '::1'];

	return {
		host: process.env.LISTENING_HOST || settings.listeningHost || '0.0.0.0',
		trustProxy: parseBoolean(process.env.LISTENER_TRUST_PROXY, settings.listenerTrustProxy === true),
		trustedProxies: parseList(process.env.LISTENER_TRUSTED_PROXIES, configuredProxies)
	};
}

function resolveClientAddress(req, network, filterIPAddress) {
	const peerAddress = filterIPAddress(req.socket.remoteAddress);
	const trustedPeer = network.trustProxy && network.trustedProxies.indexOf(peerAddress) !== -1;

	if (!trustedPeer) return peerAddress;

	const realIp = req.headers['x-real-ip'];
	const forwardedFor = req.headers['x-forwarded-for'];
	const forwardedAddress = typeof realIp === 'string'
		? realIp.trim()
		: typeof forwardedFor === 'string'
			? forwardedFor.split(',')[0].trim()
			: '';

	return forwardedAddress ? filterIPAddress(forwardedAddress) : peerAddress;
}

module.exports = { getListenerNetworkSettings, resolveClientAddress };
