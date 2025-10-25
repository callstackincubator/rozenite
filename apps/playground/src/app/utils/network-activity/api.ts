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

export const api = {
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

  getPosts: async (): Promise<Post[]> => {
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/posts?_limit=10&userId=1&sort=desc',
      {
        headers: {
          'X-Rozenite-Test': 'true',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getTodos: async (): Promise<Todo[]> => {
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/todos?_limit=15',
      {
        headers: {
          'X-Rozenite-Test': 'true',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getSlowData: async (): Promise<User[]> => {
    // Add artificial delay to simulate slow network
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/users?_limit=5',
      {
        headers: {
          'X-Rozenite-Test': 'true',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

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
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  get404: async (): Promise<Post[]> => {
    const response = await fetch('https://www.google.com/test');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  post404: async (): Promise<unknown> => {
    const response = await fetch('https://www.google.com/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rozenite-Test': 'true',
      },
      body: JSON.stringify({ test: 'data' }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

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
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

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
