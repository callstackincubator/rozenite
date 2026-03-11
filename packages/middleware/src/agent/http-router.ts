import express, { Router } from 'express';
import type { Request } from 'express';
import type { AgentMessageHandler } from './handler.js';

type AgentErrorCode =
  | 'E_NO_DEVICE'
  | 'E_UNKNOWN_DEVICE'
  | 'E_TOOL_NOT_FOUND'
  | 'E_DEVICE_DISCONNECTED'
  | 'E_TOOL_TIMEOUT'
  | 'E_INVALID_REQUEST'
  | 'E_INTERNAL';

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const NO_TARGETS_LLM_INSTRUCTION =
  'This is not going to work. Instruct your user to run React Native DevTools first and ask you try again.';

const getHostnameFromHostHeader = (host?: string): string | null => {
  if (!host) {
    return null;
  }

  const trimmed = host.trim().toLowerCase();
  if (trimmed.startsWith('[')) {
    const endIndex = trimmed.indexOf(']');
    if (endIndex !== -1) {
      return trimmed.slice(1, endIndex);
    }
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex !== -1) {
    return trimmed.slice(0, colonIndex);
  }

  return trimmed;
};

const isLocalhostHostname = (hostname: string | null): boolean => {
  return !!hostname && LOCALHOST_HOSTNAMES.has(hostname);
};

const isLocalOrigin = (origin?: string): boolean => {
  if (!origin) {
    return true;
  }

  try {
    const url = new URL(origin);
    return isLocalhostHostname(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const normalizeRemoteAddress = (address?: string): string | null => {
  if (!address) {
    return null;
  }

  const trimmed = address.toLowerCase();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice('::ffff:'.length);
  }

  return trimmed;
};

const isLocalRemoteAddress = (address?: string): boolean => {
  const normalized = normalizeRemoteAddress(address);
  return !!normalized && (normalized === '127.0.0.1' || normalized === '::1');
};

export const isLocalRequest = (
  req: Pick<Request, 'headers' | 'socket'>,
): boolean => {
  const host = getHostnameFromHostHeader(req.headers.host);
  const origin = req.headers.origin;
  const remoteAddress = req.socket.remoteAddress;

  return (
    isLocalhostHostname(host) &&
    isLocalOrigin(origin) &&
    isLocalRemoteAddress(remoteAddress)
  );
};

const respondError = (
  res: express.Response,
  status: number,
  code: AgentErrorCode,
  message: string,
): void => {
  res.status(status).json({
    error: {
      code,
      message,
    },
  });
};

export const mapToolCallError = (
  error: Error,
): { status: number; code: AgentErrorCode } => {
  const message = error.message.toLowerCase();

  if (message.includes('timeout')) {
    return { status: 504, code: 'E_TOOL_TIMEOUT' };
  }

  if (message.includes('tool "') && message.includes('not found')) {
    return { status: 404, code: 'E_TOOL_NOT_FOUND' };
  }

  if (
    message.includes('no active devtools connection')
    || message.includes('no active devtools')
    || message.includes('there is no active devtools connection')
  ) {
    return { status: 409, code: 'E_DEVICE_DISCONNECTED' };
  }

  return { status: 500, code: 'E_INTERNAL' };
};

export const createAgentRouter = (handler: AgentMessageHandler): Router => {
  const router = express.Router();

  router.use(express.json());

  router.use((req, res, next) => {
    if (!isLocalRequest(req)) {
      respondError(res, 403, 'E_INVALID_REQUEST', 'Forbidden');
      return;
    }
    next();
  });

  router.get('/devices', (_req, res) => {
    const devices = handler.getDevices();
    res.json({
      devices: devices.map((device) => ({
        id: device.id,
        name: device.name,
        reactNativeVersion: device.reactNativeVersion,
      })),
    });
  });

  router.get('/tools', (req, res) => {
    const deviceId = typeof req.query.deviceId === 'string'
      ? req.query.deviceId
      : undefined;

    if (req.query.deviceId !== undefined && !deviceId) {
      respondError(res, 400, 'E_INVALID_REQUEST', 'Invalid deviceId query parameter');
      return;
    }

    const devices = handler.getDevices();
    if (devices.length === 0) {
      respondError(
        res,
        409,
        'E_NO_DEVICE',
        `No connected device is available. Open React Native DevTools for a device and try again. ${NO_TARGETS_LLM_INSTRUCTION}`,
      );
      return;
    }

    if (deviceId && !devices.some((device) => device.id === deviceId)) {
      respondError(res, 400, 'E_UNKNOWN_DEVICE', `Unknown deviceId "${deviceId}"`);
      return;
    }

    const tools = handler.getTools(deviceId);
    res.json({ tools });
  });

  router.post('/tool-call', async (req, res) => {
    const body = req.body;
    const requestBody =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;

    if (!requestBody) {
      respondError(res, 400, 'E_INVALID_REQUEST', 'Body must be a JSON object');
      return;
    }

    const name = requestBody.name;
    if (typeof name !== 'string' || !name.trim()) {
      respondError(res, 400, 'E_INVALID_REQUEST', '"name" is required and must be a string');
      return;
    }

    const devices = handler.getDevices();
    if (devices.length === 0) {
      respondError(
        res,
        409,
        'E_NO_DEVICE',
        `No connected device is available. Open React Native DevTools for a device and try again. ${NO_TARGETS_LLM_INSTRUCTION}`,
      );
      return;
    }

    const maybeDeviceId = requestBody.deviceId;
    if (maybeDeviceId !== undefined && typeof maybeDeviceId !== 'string') {
      respondError(res, 400, 'E_INVALID_REQUEST', '"deviceId" must be a string');
      return;
    }

    const deviceId = typeof maybeDeviceId === 'string' ? maybeDeviceId : undefined;
    if (deviceId && !devices.some((device) => device.id === deviceId)) {
      respondError(res, 400, 'E_UNKNOWN_DEVICE', `Unknown deviceId "${deviceId}"`);
      return;
    }

    const argumentsValue = requestBody.arguments;
    if (
      argumentsValue !== undefined
      && (argumentsValue === null
        || typeof argumentsValue !== 'object'
        || Array.isArray(argumentsValue))
    ) {
      respondError(res, 400, 'E_INVALID_REQUEST', '"arguments" must be a JSON object');
      return;
    }

    try {
      const callArgs = {
        ...((argumentsValue as Record<string, unknown>) || {}),
        ...(deviceId ? { deviceId } : {}),
      };
      const result = await handler.callTool(name, callArgs);
      res.json({ result });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Internal Agent error');
      const mapped = mapToolCallError(err);
      respondError(res, mapped.status, mapped.code, err.message);
    }
  });

  return router;
};
