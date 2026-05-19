import { useEffect, useRef, useState } from 'react';
import type { DevFlowContext, DevFlowMessage, DevFlowMessageMatcher } from '../load-config.js';
import type { DevHostFlowEntry, DevHostFlowRunState, MessageEntry } from './types.js';

type FlowRunnerOptions = {
  sendMessage: (type: string, payload: unknown) => void;
};

type ActiveFlowRun = {
  id: string;
  flowName: string;
  flowDisplayName: string;
  autoRun: boolean;
  controller: AbortController;
  listeners: Map<number, (message: DevFlowMessage) => void>;
  cleanups: Set<() => void>;
};

const createAbortError = () => {
  return new DOMException('Flow execution was stopped.', 'AbortError');
};

const isAbortError = (error: unknown) => {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
};

const toFlowMessage = (message: MessageEntry): DevFlowMessage => {
  return {
    id: message.id,
    direction: message.direction,
    date: message.date,
    type: message.type,
    payload: message.payload,
  };
};

const matchesMessage = (
  message: DevFlowMessage,
  matcher?: DevFlowMessageMatcher,
) => {
  if (!matcher) {
    return true;
  }

  if (typeof matcher === 'string') {
    return message.type === matcher;
  }

  if (typeof matcher === 'function') {
    return matcher(message);
  }

  return (
    (matcher.type == null || message.type === matcher.type) &&
    (matcher.direction == null || message.direction === matcher.direction) &&
    (matcher.predicate == null || matcher.predicate(message))
  );
};

const formatFlowError = (error: unknown) => {
  if (isAbortError(error)) {
    return 'Flow execution was stopped.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

export const useFlowRunner = ({ sendMessage }: FlowRunnerOptions) => {
  const [flowRuns, setFlowRuns] = useState<DevHostFlowRunState[]>([]);
  const messagesRef = useRef<MessageEntry[]>([]);
  const activeRunsRef = useRef<Map<string, ActiveFlowRun>>(new Map());
  const listenerIdRef = useRef(0);

  useEffect(() => {
    return () => {
      activeRunsRef.current.forEach((run) => {
        run.controller.abort();
        run.cleanups.forEach((cleanup) => cleanup());
      });
      activeRunsRef.current.clear();
    };
  }, []);

  const stopFlow = (runId: string) => {
    const activeRun = activeRunsRef.current.get(runId);
    if (!activeRun) {
      return;
    }

    activeRun.controller.abort();
  };

  const registerMessage = (message: MessageEntry) => {
    messagesRef.current = [message, ...messagesRef.current];

    const flowMessage = toFlowMessage(message);
    activeRunsRef.current.forEach((activeRun) => {
      activeRun.listeners.forEach((listener) => {
        listener(flowMessage);
      });
    });
  };

  const resetMessages = () => {
    messagesRef.current = [];
  };

  const runFlow = (flow: DevHostFlowEntry, options?: { autoRun?: boolean }) => {
    const duplicateRun = [...activeRunsRef.current.values()].find(
      (run) => run.flowName === flow.name,
    );

    if (duplicateRun) {
      return duplicateRun.id;
    }

    const runId = crypto.randomUUID();
    const controller = new AbortController();
    const activeRun: ActiveFlowRun = {
      id: runId,
      flowName: flow.name,
      flowDisplayName: flow.displayName,
      autoRun: options?.autoRun ?? flow.autoRun,
      controller,
      listeners: new Map(),
      cleanups: new Set(),
    };

    const throwIfAborted = () => {
      if (controller.signal.aborted) {
        throw createAbortError();
      }
    };

      const cleanupRun = () => {
        activeRun.cleanups.forEach((cleanup) => cleanup());
        activeRun.cleanups.clear();
        activeRun.listeners.clear();
        activeRunsRef.current.delete(runId);
      };

    const onMessage: DevFlowContext['onMessage'] = (matcher, listener) => {
      throwIfAborted();

      const listenerId = listenerIdRef.current + 1;
      listenerIdRef.current = listenerId;

      const wrappedListener = (message: DevFlowMessage) => {
        if (matchesMessage(message, matcher)) {
          listener(message);
        }
      };

      activeRun.listeners.set(listenerId, wrappedListener);

      const remove = () => {
        activeRun.listeners.delete(listenerId);
        controller.signal.removeEventListener('abort', remove);
        activeRun.cleanups.delete(remove);
      };

      controller.signal.addEventListener('abort', remove, { once: true });
      activeRun.cleanups.add(remove);

      return { remove };
    };

    const flowContext: DevFlowContext = {
      signal: controller.signal,
      send: (type, payload) => {
        throwIfAborted();
        sendMessage(type, payload);
      },
      onMessage,
      waitForMessage: (matcher, options) => {
        throwIfAborted();

        return new Promise((resolve, reject) => {
          let timeoutId: number | null = null;

          const cleanup = () => {
            subscription.remove();
            controller.signal.removeEventListener('abort', handleAbort);

            if (timeoutId !== null) {
              window.clearTimeout(timeoutId);
            }
          };

          const handleAbort = () => {
            cleanup();
            reject(createAbortError());
          };

          const subscription = onMessage(matcher, (message) => {
            cleanup();
            resolve(message);
          });

          controller.signal.addEventListener('abort', handleAbort, { once: true });

          if (options?.timeoutMs != null) {
            timeoutId = window.setTimeout(() => {
              cleanup();
              reject(
                new Error(`Timed out waiting for a matching message after ${options.timeoutMs}ms.`),
              );
            }, options.timeoutMs);
          }
        });
      },
      getMessages: (matcher) => {
        throwIfAborted();

        return messagesRef.current
          .map(toFlowMessage)
          .filter((message) => matchesMessage(message, matcher));
      },
    };

    activeRunsRef.current.set(runId, activeRun);
    setFlowRuns((current) => [
      {
        id: runId,
        flowName: flow.name,
        flowDisplayName: flow.displayName,
        status: 'running',
        result: null,
        error: null,
        autoRun: activeRun.autoRun,
      },
      ...current,
    ]);

    const updateRunState = (nextState: Partial<Omit<DevHostFlowRunState, 'id' | 'flowName' | 'flowDisplayName' | 'autoRun'>>) => {
      setFlowRuns((current) =>
        current.map((run) =>
          run.id === runId
            ? {
                ...run,
                ...nextState,
              }
            : run,
        ),
      );
    };

    Promise.resolve(flow.run(flowContext))
      .then((result) => {
        if (controller.signal.aborted) {
          updateRunState({
            status: 'aborted',
            result: null,
            error: 'Flow execution was stopped.',
          });
          return;
        }

        updateRunState({
          status: 'succeeded',
          result,
          error: null,
        });
      })
      .catch((error) => {
        updateRunState({
          status: isAbortError(error) ? 'aborted' : 'failed',
          result: null,
          error: formatFlowError(error),
        });
      })
      .finally(() => {
        cleanupRun();
      });

    return runId;
  };

  const hasRunningFlow = (flowName: string) => {
    return flowRuns.some((run) => run.flowName === flowName && run.status === 'running');
  };

  return {
    flowRuns,
    runFlow,
    stopFlow,
    hasRunningFlow,
    registerMessage,
    resetMessages,
  };
};
