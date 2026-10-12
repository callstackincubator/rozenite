import { Command, Option } from 'commander';
import { createAgentTransport } from '@rozenite/agent-sdk/transport';
import type { AgentTapStreamHandle } from '@rozenite/agent-sdk';
import { DEFAULT_AGENT_HOST, DEFAULT_AGENT_PORT } from '@rozenite/agent-shared';
import { formatTapEventLine, formatTapEventNdjson } from './tap-format.js';
import { getErrorMessage } from './error-message.js';
import { isStdoutTTY } from './output.js';
import { resolveAgentSession, type SessionSelection } from './session-resolution.js';

type TapOptions = {
  /** Explicit session; when absent the session is resolved like any agent command. */
  session?: string;
  device?: string;
  deviceId?: string;
  plugin?: string;
  type?: string;
  payload: string;
  /**
   * Forces newline-delimited JSON. Without it, the output follows the
   * stream: NDJSON to a pipe, arrow lines to a terminal.
   */
  json?: boolean;
  /** Whether stdout is a terminal; defaults to asking `process.stdout`. */
  tty?: boolean;
};

type TapCommandOptions = TapOptions & {
  host: string;
  port: string;
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
  const asJson = !!options.json || !(options.tty ?? isStdoutTTY());

  let payload: unknown;
  try {
    payload = parseTapPayload(options.payload);
  } catch (error) {
    reportTapError(error, asJson);
    return;
  }

  if (options.type && !options.plugin) {
    reportTapError(
      new Error(
        'A plugin is required to send a message: rozenite agent tap <plugin> --send <type>',
      ),
      asJson,
    );
    return;
  }

  const transport = createAgentTransport({
    host: options.host,
    port: Number(options.port),
  });

  let sessionId: string;
  try {
    sessionId = (
      await resolveAgentSession(transport, {
        session: options.session,
        device: options.device,
        deviceId: options.deviceId,
      })
    ).sessionId;
  } catch (error) {
    reportTapError(error, asJson);
    return;
  }

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
      sessionId,
      // `--send` names the outbound message being sent, not a display
      // filter — filtering on it would hide the very response the poke is
      // meant to surface. Only the plugin narrows what's streamed.
      { pluginId: options.plugin },
      {
        onOpen: () => {
          if (!options.type || !options.plugin) {
            return;
          }

          transport
            .sendSessionTapMessage(sessionId, {
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

type TapCliOptions = {
  send?: string;
  type?: string;
  plugin?: string;
  payload: string;
  a?: string;
};

export const registerTapCommand = (agentCommand: Command): void => {
  agentCommand
    .command('tap')
    // `rozenite agent` turns its help option off for tool help; turn it back on.
    .helpOption('-h, --help', 'Display help')
    .description(
      "Stream a session's plugin messages in both directions (NDJSON when piped), and optionally send one",
    )
    .argument('[plugin]', 'Only stream this plugin; required with --send')
    .option('--send <type>', 'Send one message of this type to the plugin, then keep streaming')
    .option('--payload <json>', 'JSON payload for the sent message', '{}')
    // Spellings from before the plugin became a positional (ADR 0005,
    // decision 7). Accepted, no longer documented.
    .addOption(new Option('-p, --plugin <id>', 'Same as the plugin argument').hideHelp())
    .addOption(new Option('-t, --type <name>', 'Same as --send').hideHelp())
    .addOption(new Option('-a <json>', 'Same as --payload').hideHelp())
    .addOption(new Option('--json', 'Newline-delimited JSON on a terminal too').hideHelp())
    .addOption(new Option('-s, --session <id>', 'Session to use').hideHelp())
    // `--host`/`--port`/`--session`/`--device` are inherited from
    // `rozenite agent`, the same way `rozenite agent targets` reads them,
    // rather than redeclared here.
    .action(
      async (pluginArgument: string | undefined, options: TapCliOptions, command: Command) => {
        const globals = command.optsWithGlobals<
          SessionSelection & { host?: string; port?: string; json?: boolean }
        >();
        if (pluginArgument && options.plugin && pluginArgument !== options.plugin) {
          process.stderr.write(
            `Plugin given twice: "${pluginArgument}" and --plugin "${options.plugin}".\n`,
          );
          process.exitCode = 1;
          return;
        }

        await runTapCommand({
          session: globals.session,
          device: globals.device,
          deviceId: globals.deviceId,
          plugin: pluginArgument ?? options.plugin,
          type: options.send ?? options.type,
          payload: options.a ?? options.payload,
          json: globals.json,
          host: globals.host ?? DEFAULT_AGENT_HOST,
          port: String(globals.port ?? DEFAULT_AGENT_PORT),
        });
      },
    );
};
