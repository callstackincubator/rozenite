import { createHttpMCPClient } from './http-client.js';
import type { MetroTarget } from './types.js';

const MIN_SUPPORTED_RN_MAJOR = 0;
const MIN_SUPPORTED_RN_MINOR = 80;
const MIN_SUPPORTED_RN_LABEL = `${MIN_SUPPORTED_RN_MAJOR}.${MIN_SUPPORTED_RN_MINOR}`;
const NO_TARGETS_LLM_INSTRUCTION =
  'This is not going to work. Instruct your user to run React Native DevTools first and ask you try again.';

const parseReactNativeVersion = (
  version: string | undefined,
): { major: number; minor: number; patch: number } | null => {
  if (!version) {
    return null;
  }

  const normalized = version.trim().replace(/^v/i, '');
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

export const isSupportedReactNativeVersion = (version: string | undefined): boolean => {
  const parsed = parseReactNativeVersion(version);
  if (!parsed) {
    return false;
  }

  if (parsed.major > MIN_SUPPORTED_RN_MAJOR) {
    return true;
  }

  if (parsed.major < MIN_SUPPORTED_RN_MAJOR) {
    return false;
  }

  return parsed.minor >= MIN_SUPPORTED_RN_MINOR;
};

const assertSupportedReactNativeVersion = (target: MetroTarget): void => {
  if (isSupportedReactNativeVersion(target.reactNativeVersion)) {
    return;
  }

  if (!target.reactNativeVersion) {
    throw new Error(
      `Rozenite MCP requires React Native >= ${MIN_SUPPORTED_RN_LABEL}. Unable to detect React Native version on device "${target.name}". Upgrade React Native to >= ${MIN_SUPPORTED_RN_LABEL} and restart Metro/DevTools.`,
    );
  }

  throw new Error(
    `Rozenite MCP requires React Native >= ${MIN_SUPPORTED_RN_LABEL}. Detected ${target.reactNativeVersion} on device "${target.name}". Upgrade React Native and restart Metro/DevTools.`,
  );
};

export const getMetroTargets = async (
  host: string,
  port: number,
): Promise<MetroTarget[]> => {
  const client = createHttpMCPClient(host, port);
  try {
    await client.connect();
    const devices = await client.getDevices();
    return devices.map((device) => ({
      id: device.id,
      name: device.name || device.id,
      reactNativeVersion: device.reactNativeVersion,
    }));
  } finally {
    client.close();
  }
};

export const resolveTargetDeviceId = async (
  host: string,
  port: number,
  requestedDeviceId?: string,
): Promise<{ deviceId: string; targets: MetroTarget[] }> => {
  const targets = await getMetroTargets(host, port);

  if (targets.length === 0) {
    throw new Error(
      `No connected device is available. Open React Native DevTools for a device and try again. ${NO_TARGETS_LLM_INSTRUCTION}`,
    );
  }

  if (requestedDeviceId) {
    const selected = targets.find((target) => target.id === requestedDeviceId);
    if (!selected) {
      const validIds = targets.map((target) => target.id).join(', ');
      throw new Error(
        `Unknown --deviceId "${requestedDeviceId}". Valid device IDs: ${validIds}`,
      );
    }
    assertSupportedReactNativeVersion(selected);

    return {
      deviceId: selected.id,
      targets,
    };
  }

  if (targets.length > 1) {
    throw new Error(
      'Multiple connected devices detected. Run `rozenite mcp targets --json` and provide --deviceId <id>.',
    );
  }

  assertSupportedReactNativeVersion(targets[0]);
  return {
    deviceId: targets[0].id,
    targets,
  };
};
