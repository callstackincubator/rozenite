import { Command } from 'commander';
import { createAgentTransport } from '@rozenite/agent-sdk/transport';
import type { AgentTapStreamHandle } from '@rozenite/agent-sdk';
import { DEFAULT_AGENT_HOST, DEFAULT_AGENT_PORT } from '@rozenite/agent-shared';
import { formatTapEventLine, formatTapEventNdjson } from './tap-format.js';
import { getErrorMessage } from './error-message.js';

type TapCommandOptions = {
  host: string;
  port: string;
  session: string;
  plugin?: string;
  type?: string;
  payload: string;
  json?: boolean;
};

export const parseTapPayload = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('--payload must be valid JSON');
  }
};

const reportTapError = (error: unknown, asJson: boolean): void => {
  const message = getErrorMessage(error);
  if (asJson) {
    process.stdout.write(`${JSON.stringify({ error: { message } })}\n`);
  } else {
    process.stderr.write(`${message}\n`);
  }
  process.exitCode = 1;
};

export const runTapCommand = async (options: TapCommandOptions): Promise<void> => {
  const asJson = !!options.json;

  let payload: unknown;
  try {
    payload = parseTapPayload(options.payload);
  } catch (error) {
    reportTapError(error, asJson);
    return;
  }

  if (options.type && !options.plugin) {
    reportTapError(new Error('--plugin is required when --type is provided'), asJson);
    return;
  }

  const transport = createAgentTransport({
    host: options.host,
    port: Number(options.port),
  });

  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      resolve();
    };

    const onSignal = (): void => {
      handle.close();
      finish();
    };

    const handle: AgentTapStreamHandle = transport.openSessionTap(
      options.session,
      // `--type` names the outbound message being sent, not a display
      // filter — filtering on it would hide the very response the poke is
      // meant to surface. Only `--plugin` narrows what's streamed.
      { pluginId: options.plugin },
      {
        onOpen: () => {
          if (!options.type || !options.plugin) {
            return;
          }

          transport
            .sendSessionTapMessage(options.session, {
              pluginId: options.plugin,
              type: options.type,
              payload,
            })
            .catch((error: unknown) => {
              reportTapError(error, asJson);
              handle.close();
              finish();
            });
        },
        onEvent: (event) => {
          process.stdout.write(
            `${asJson ? formatTapEventNdjson(event) : formatTapEventLine(event)}\n`,
          );
        },
        onError: (error) => {
          reportTapError(error, asJson);
          finish();
        },
        onEnd: finish,
      },
    );

    // Registered after `handle` exists: nothing yields the event loop
    // between the two, so no signal can arrive in between.
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
  });
};

export const registerTapCommand = (program: Command): void => {
  program
    .command('tap')
    .description(
      "Stream a session's Rozenite plugin messages to stdout in both directions, and optionally send one",
    )
    .option('--host <host>', 'Metro host', DEFAULT_AGENT_HOST)
    .option('--port <port>', 'Metro port', String(DEFAULT_AGENT_PORT))
    .requiredOption('-s, --session <id>', 'Target Agent session ID')
    .option('-p, --plugin <id>', 'Filter the stream to this plugin ID; required with --type')
    .option(
      '-t, --type <name>',
      'Send one message of this type before watching the stream (requires --plugin)',
    )
    .option('-a, --payload <json>', 'JSON payload for the sent message', '{}')
    .option('--json', 'Newline-delimited JSON output, one message per line')
    .action(async (options: TapCommandOptions) => {
      await runTapCommand(options);
    });
};
