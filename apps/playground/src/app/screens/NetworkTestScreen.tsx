import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Real API service using JSONPlaceholder
const api = {
  getUsers: async (): Promise<User[]> => {
    const response = await fetch('https://jsonplaceholder.typicode.com/users', {
      headers: {
        'X-Rozenite-Test': 'true',
        Cookie: 'test=test',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  getPosts: async (): Promise<Post[]> => {
    const response = await fetch(
      'https://jsonplaceholder.typicode.com/posts?_limit=10',
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

  // Simulate a slow API call
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

  // Simulate an API that sometimes fails
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

  // Create a new post
  createPost: async (postData: Omit<Post, 'id'>): Promise<Post> => {
    const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rozenite-Test': 'true',
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};

interface User {
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

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  userId: number;
}

const useUsersQuery = () => {
  useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
    staleTime: 8 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

const usePostsQuery = () => {
  return useQuery({
    queryKey: ['posts'],
    queryFn: api.getPosts,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

const useTodosQuery = () => {
  return useQuery({
    queryKey: ['todos'],
    queryFn: api.getTodos,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
  });
};

const useSlowDataQuery = () => {
  return useQuery({
    queryKey: ['slow-data'],
    queryFn: api.getSlowData,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
};

const useUnreliableDataQuery = () => {
  return useQuery({
    queryKey: ['unreliable-data'],
    queryFn: api.getUnreliableData,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 3, // Retry up to 3 times
  });
};

const useCreatePostMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createPost,
    onSuccess: () => {
      // Invalidate and refetch posts query to show the new post
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      // Optionally, you could also update the cache directly
      // queryClient.setQueryData(['posts'], (oldData: Post[] | undefined) => {
      //   return oldData ? [newPost, ...oldData] : [newPost];
      // });
    },
  });
};

const UserCard: React.FC<{ user: User }> = ({ user }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{user.name}</Text>
      <Text style={styles.cardSubtitle}>@{user.username}</Text>
    </View>
    <Text style={styles.cardEmail}>{user.email}</Text>
    <Text style={styles.cardCompany}>{user.company.name}</Text>
    <Text style={styles.cardWebsite}>{user.website}</Text>
  </View>
);

const PostCard: React.FC<{ post: Post }> = ({ post }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{post.title}</Text>
    <Text style={styles.cardBody}>{post.body}</Text>
    <Text style={styles.cardMeta}>User ID: {post.userId}</Text>
  </View>
);

const TodoCard: React.FC<{ todo: Todo }> = ({ todo }) => (
  <View style={styles.card}>
    <View style={styles.todoHeader}>
      <Text style={[styles.todoTitle, todo.completed && styles.todoCompleted]}>
        {todo.title}
      </Text>
      <View
        style={[
          styles.todoStatus,
          todo.completed
            ? styles.todoStatusCompleted
            : styles.todoStatusPending,
        ]}
      >
        <Text style={styles.todoStatusText}>{todo.completed ? '✓' : '○'}</Text>
      </View>
    </View>
    <Text style={styles.cardMeta}>User ID: {todo.userId}</Text>
  </View>
);

export const NetworkTestScreen: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<
    'users' | 'posts' | 'todos' | 'slow' | 'unreliable' | 'create'
  >('users');
  const [newPostTitle, setNewPostTitle] = React.useState('');
  const [newPostBody, setNewPostBody] = React.useState('');

  const usersQuery = useUsersQuery();
  const postsQuery = usePostsQuery();
  const todosQuery = useTodosQuery();
  const slowQuery = useSlowDataQuery();
  const unreliableQuery = useUnreliableDataQuery();
  const createPostMutation = useCreatePostMutation();

  const getActiveQuery = () => {
    switch (activeTab) {
      case 'users':
        return usersQuery;
      case 'posts':
        return postsQuery;
      case 'todos':
        return todosQuery;
      case 'slow':
        return slowQuery;
      case 'unreliable':
        return unreliableQuery;
      default:
        return usersQuery;
    }
  };

  const activeQuery = getActiveQuery();
  const { data, isLoading, error, refetch, isRefetching } = activeQuery;

  const handleCreatePost = () => {
    if (!newPostTitle.trim() || !newPostBody.trim()) {
      return;
    }

    createPostMutation.mutate(
      {
        title: newPostTitle,
        body: newPostBody,
        userId: 1, // Default user ID
      },
      {
        onSuccess: () => {
          setNewPostTitle('');
          setNewPostBody('');
          // Switch to posts tab to see the new post
          setActiveTab('posts');
        },
      }
    );
  };

  const renderItem = ({ item }: { item: User | Post | Todo }) => {
    switch (activeTab) {
      case 'users':
        return <UserCard user={item as User} />;
      case 'posts':
        return <PostCard post={item as Post} />;
      case 'todos':
        return <TodoCard todo={item as Todo} />;
      case 'slow':
        return <UserCard user={item as User} />;
      case 'unreliable':
        return <PostCard post={item as Post} />;
      default:
        return <UserCard user={item as User} />;
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Network Test</Text>
      <Text style={styles.subtitle}>Testing TanStack Query with real APIs</Text>

      <View style={styles.tabContainer}>
        {[
          { key: 'users', label: 'Users' },
          { key: 'posts', label: 'Posts' },
          { key: 'todos', label: 'Todos' },
          { key: 'slow', label: 'Slow' },
          { key: 'unreliable', label: 'Unreliable' },
          { key: 'create', label: 'Create' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() =>
              setActiveTab(
                tab.key as
                  | 'users'
                  | 'posts'
                  | 'todos'
                  | 'slow'
                  | 'unreliable'
                  | 'create'
              )
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Status</Text>
          <Text
            style={[
              styles.statValue,
              { color: isLoading ? '#FFA500' : error ? '#FF4444' : '#4CAF50' },
            ]}
          >
            {isLoading ? 'Loading...' : error ? 'Error' : 'Success'}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Count</Text>
          <Text style={styles.statValue}>{data?.length || 0}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>API</Text>
          <Text style={styles.statValue}>{activeTab}</Text>
        </View>
      </View>

      {activeTab === 'create' ? (
        <View style={styles.createForm}>
          <Text style={styles.formTitle}>Create New Post</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              value={newPostTitle}
              onChangeText={setNewPostTitle}
              placeholder="Enter post title..."
              placeholderTextColor="#666666"
              multiline
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Body</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={newPostBody}
              onChangeText={setNewPostBody}
              placeholder="Enter post content..."
              placeholderTextColor="#666666"
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.createButton,
              (!newPostTitle.trim() ||
                !newPostBody.trim() ||
                createPostMutation.isPending) &&
                styles.createButtonDisabled,
            ]}
            onPress={handleCreatePost}
            disabled={
              !newPostTitle.trim() ||
              !newPostBody.trim() ||
              createPostMutation.isPending
            }
          >
            {createPostMutation.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.createButtonText}>Create Post</Text>
            )}
          </TouchableOpacity>

          {createPostMutation.isError && (
            <Text style={styles.errorText}>
              Error: {createPostMutation.error?.message}
            </Text>
          )}

          {createPostMutation.isSuccess && (
            <Text style={styles.successText}>Post created successfully!</Text>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.refetchButton,
            isRefetching && styles.refetchButtonDisabled,
          ]}
          onPress={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.refetchButtonText}>Refetch Data</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading && !data) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading {activeTab}...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Loading Data</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 20,
  },
  errorTitle: {
    color: '#FF4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#a0a0a0',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#a0a0a0',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 15,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  refetchButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  refetchButtonDisabled: {
    backgroundColor: '#666666',
  },
  refetchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1a1a1a',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  cardEmail: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  cardWebsite: {
    fontSize: 12,
    color: '#007AFF',
  },
  cardBody: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 8,
    lineHeight: 20,
  },
  cardMeta: {
    fontSize: 12,
    color: '#666666',
  },
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  todoTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  todoCompleted: {
    textDecorationLine: 'line-through',
    color: '#666666',
  },
  todoStatus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  todoStatusPending: {
    borderColor: '#FFA500',
  },
  todoStatusCompleted: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50',
  },
  todoStatusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  createForm: {
    marginTop: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#ffffff',
    minHeight: 44,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  createButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#666666',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  successText: {
    color: '#4CAF50',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});
