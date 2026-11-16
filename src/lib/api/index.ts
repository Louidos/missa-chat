/**
 * Anbindung an die Missa-API (OpenAI-kompatibel). Dies ist die einzige Stelle,
 * die mit dem Server redet. Ein anderes API-Format wird nur hier angepasst.
 */
export const API_VERSION_PREFIX = '/v1';
export const DEFAULT_API_URL = 'https://ki.louis-degiorgi.ch';

export * from './errors';
export * from './url';
export * from './client';
export * from './endpoint';
export * from './chat';
