import {
  fetch as nitroFetch,
  prefetch as nitroPrefetch,
} from 'react-native-nitro-fetch';
import type { Post, User } from './api';

const PREFETCH_KEY = 'playground-nitro-uuid';

export type NitroDemoResult = {
  title: string;
  status: number;
  statusText: string;
  body: string;
  extra?: string;
};

const prettyPrint = (value: unknown) => JSON.stringify(value, null, 2);

export const nitroApi = {
  async getUsers(): Promise<NitroDemoResult> {
    const response = await nitroFetch(
      'https://jsonplaceholder.typicode.com/users?_limit=3',
      {
        headers: {
          'X-Rozenite-Test': 'nitro-users',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Nitro request failed with status ${response.status}`);
    }

    const users = (await response.json()) as User[];

    return {
      title: 'Nitro GET users',
      status: response.status,
      statusText: response.statusText,
      body: prettyPrint(users),
      extra: `Fetched ${users.length} users via react-native-nitro-fetch.`,
    };
  },

  async createPost(): Promise<NitroDemoResult> {
    const payload: Omit<Post, 'id'> = {
      userId: 1,
      title: 'Rozenite Nitro test post',
      body: 'This request was created from the playground using react-native-nitro-fetch.',
    };

    const response = await nitroFetch(
      'https://jsonplaceholder.typicode.com/posts?source=nitro-playground',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Rozenite-Test': 'nitro-create-post',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`Nitro request failed with status ${response.status}`);
    }

    const post = (await response.json()) as Post;

    return {
      title: 'Nitro POST JSON',
      status: response.status,
      statusText: response.statusText,
      body: prettyPrint(post),
      extra:
        'Creates a POST entry with a Nitro source badge in Network Activity.',
    };
  },

  async prefetchUuid(): Promise<NitroDemoResult> {
    await nitroPrefetch('https://httpbin.org/uuid', {
      headers: {
        prefetchKey: PREFETCH_KEY,
        'X-Rozenite-Test': 'nitro-prefetch',
      },
    });

    const response = await nitroFetch('https://httpbin.org/uuid', {
      headers: {
        prefetchKey: PREFETCH_KEY,
        'X-Rozenite-Test': 'nitro-prefetch-consume',
      },
    });

    if (!response.ok) {
      throw new Error(`Nitro request failed with status ${response.status}`);
    }

    const prefetched = response.headers.get('nitroPrefetched');
    const body = await response.text();

    return {
      title: 'Nitro prefetch + consume',
      status: response.status,
      statusText: response.statusText,
      body,
      extra: `nitroPrefetched header: ${prefetched ?? 'missing'}`,
    };
  },

  async abortSlowRequest(): Promise<NitroDemoResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 250);

    try {
      await nitroFetch('https://httpbin.org/delay/5', {
        signal: controller.signal,
        headers: {
          'X-Rozenite-Test': 'nitro-abort',
        },
      });

      return {
        title: 'Nitro AbortController',
        status: 200,
        statusText: 'Unexpected success',
        body: 'The delayed request completed before aborting.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        title: 'Nitro AbortController',
        status: 0,
        statusText: 'Aborted',
        body: message,
        extra:
          'Use this to verify failed Nitro requests show up in Network Activity.',
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
