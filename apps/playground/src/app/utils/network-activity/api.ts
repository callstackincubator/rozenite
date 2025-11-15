/**
 * Shared API utilities for the playground app
 */

export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
  phone: string;
  website: string;
  company: {
    name: string;
    catchPhrase: string;
  };
}

export interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  userId: number;
}

/**
 * Real API service using JSONPlaceholder
 */
export const api = {
  /**
   * Fetches users from JSONPlaceholder API
   * Used for testing network inspector during app boot
   */
  getUsers: async (): Promise<User[]> => {
    const response = await fetch('https://jsonplaceholder.typicode.com/users', {
      headers: {
        'X-Rozenite-Test': 'true',
        Cookie: 'sessionid=abc123; theme=dark; user=testuser',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Fetches posts from JSONPlaceholder API
   */
  getPosts: async (): Promise<Post[]> => {
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/posts?_limit=10&userId=1&sort=desc',
      {
        headers: {
          'X-Rozenite-Test': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Fetches todos from JSONPlaceholder API
   */
  getTodos: async (): Promise<Todo[]> => {
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/todos?_limit=15',
      {
        headers: {
          'X-Rozenite-Test': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Simulates a slow API call
   */
  getSlowData: async (): Promise<User[]> => {
    // Add artificial delay to simulate slow network
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/users?_limit=5',
      {
        headers: {
          'X-Rozenite-Test': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Simulates an API that sometimes fails
   */
  getUnreliableData: async (): Promise<Post[]> => {
    // 20% chance of failure
    if (Math.random() < 0.2) {
      throw new Error('Random API failure - please try again');
    }
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/posts?_limit=8',
      {
        headers: {
          'X-Rozenite-Test': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Creates a new post with JSON body
   */
  createPost: async (postData: Omit<Post, 'id'>): Promise<Post> => {
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/posts?someParam=value',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Rozenite-Test': 'true',
        },
        body: JSON.stringify(postData),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Creates a new post with FormData
   */
  createPostWithFormData: async (postData: Omit<Post, 'id'>): Promise<Post> => {
    const formData = new FormData();
    formData.append('title', postData.title);
    formData.append('body', postData.body);
    formData.append('userId', postData.userId.toString());

    const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        'X-Rozenite-Test': 'true',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};