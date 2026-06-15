import { fetch as expoFetch } from 'expo/fetch';
import type { Post, User } from './api';

export type ExpoFetchDemoResult = {
  title: string;
  status: number;
  statusText: string;
  body: string;
  extra?: string;
};

const prettyPrint = (value: unknown) => JSON.stringify(value, null, 2);

export const expoFetchApi = {
  async getUsers(): Promise<ExpoFetchDemoResult> {
    const response = await expoFetch(
      'https://jsonplaceholder.typicode.com/users?_limit=3',
      {
        headers: {
          'X-Rozenite-Test': 'expo-fetch-users',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Expo fetch request failed with status ${response.status}`);
    }

    const users = (await response.json()) as User[];

    return {
      title: 'Expo GET users',
      status: response.status,
      statusText: response.statusText,
      body: prettyPrint(users),
      extra: `Fetched ${users.length} users via expo/fetch.`,
    };
  },

  async createPost(): Promise<ExpoFetchDemoResult> {
    const payload: Omit<Post, 'id'> = {
      userId: 1,
      title: 'Rozenite Expo fetch test post',
      body: 'This request was created from the playground using expo/fetch.',
    };

    const response = await expoFetch(
      'https://jsonplaceholder.typicode.com/posts?source=expo-fetch-playground',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Rozenite-Test': 'expo-fetch-create-post',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`Expo fetch request failed with status ${response.status}`);
    }

    const post = (await response.json()) as Post;

    return {
      title: 'Expo POST JSON',
      status: response.status,
      statusText: response.statusText,
      body: prettyPrint(post),
      extra: 'Creates a POST entry with an Expo source badge in Network Activity.',
    };
  },

  async abortSlowRequest(): Promise<ExpoFetchDemoResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 250);

    try {
      await expoFetch('https://httpbin.org/delay/5', {
        signal: controller.signal,
        headers: {
          'X-Rozenite-Test': 'expo-fetch-abort',
        },
      });

      return {
        title: 'Expo AbortController',
        status: 200,
        statusText: 'Unexpected success',
        body: 'The delayed request completed before aborting.',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        title: 'Expo AbortController',
        status: 0,
        statusText: 'Aborted',
        body: message,
        extra:
          'Use this to verify failed Expo fetch requests show up in Network Activity.',
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
