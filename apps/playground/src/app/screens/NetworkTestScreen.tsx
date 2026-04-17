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
  ScrollView,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import EventSource from 'react-native-sse';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import {
  NitroWebSocket,
  type WebSocketCloseEvent as NitroWebSocketCloseEvent,
  type WebSocketMessageEvent as NitroWebSocketMessageEvent,
} from 'react-native-nitro-websockets';
import { RootStackParamList } from '../navigation/types';
import { api, User, Post, Todo } from '../utils/network-activity/api';
import {
  nitroApi,
  type NitroDemoResult,
} from '../utils/network-activity/nitro';

const useUsersQuery = () => {
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

const useLargeFileQuery = () => {
  return useQuery({
    queryKey: ['large-file'],
    queryFn: api.getLargeFile,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: false, // Don't auto-fetch, only on manual trigger
  });
};

const useCreatePostMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      postData,
      useFormData,
    }: {
      postData: Omit<Post, 'id'>;
      useFormData: boolean;
    }) => {
      return useFormData
        ? api.createPostWithFormData(postData)
        : api.createPost(postData);
    },
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

const NitroHTTPTestComponent: React.FC = () => {
  const [isRunning, setIsRunning] = React.useState(false);
  const [result, setResult] = React.useState<NitroDemoResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const runNitroAction = React.useCallback(
    async (action: () => Promise<NitroDemoResult>) => {
      setIsRunning(true);
      setError(null);

      try {
        const nextResult = await action();
        setResult(nextResult);
      } catch (actionError) {
        setResult(null);
        setError(
          actionError instanceof Error
            ? actionError.message
            : String(actionError),
        );
      } finally {
        setIsRunning(false);
      }
    },
    [],
  );

  return (
    <ScrollView contentContainerStyle={styles.listContainer}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nitro HTTP Test</Text>
        <Text style={styles.cardBody}>
          Runs requests through `react-native-nitro-fetch`. Watch the Network
          Activity panel for `Nitro` source badges.
        </Text>

        <View style={styles.nitroButtonGrid}>
          <TouchableOpacity
            style={[
              styles.nitroButton,
              isRunning && styles.refetchButtonDisabled,
            ]}
            disabled={isRunning}
            onPress={() => runNitroAction(nitroApi.getUsers)}
          >
            <Text style={styles.nitroButtonText}>Nitro GET</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.nitroButton,
              isRunning && styles.refetchButtonDisabled,
            ]}
            disabled={isRunning}
            onPress={() => runNitroAction(nitroApi.createPost)}
          >
            <Text style={styles.nitroButtonText}>Nitro POST</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.nitroButton,
              isRunning && styles.refetchButtonDisabled,
            ]}
            disabled={isRunning}
            onPress={() => runNitroAction(nitroApi.prefetchUuid)}
          >
            <Text style={styles.nitroButtonText}>Prefetch</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.nitroButton,
              styles.nitroButtonDanger,
              isRunning && styles.refetchButtonDisabled,
            ]}
            disabled={isRunning}
            onPress={() => runNitroAction(nitroApi.abortSlowRequest)}
          >
            <Text style={styles.nitroButtonText}>Abort</Text>
          </TouchableOpacity>
        </View>

        {isRunning && (
          <View style={styles.nitroStatusRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.nitroStatusText}>Running Nitro request...</Text>
          </View>
        )}

        {error && <Text style={styles.errorText}>Error: {error}</Text>}

        {result && (
          <View style={styles.responseContainer}>
            <Text style={styles.responseTitle}>{result.title}</Text>
            <Text style={styles.cardMeta}>
              Status: {result.status} {result.statusText}
            </Text>
            {result.extra ? (
              <Text style={styles.nitroExtraText}>{result.extra}</Text>
            ) : null}
            <ScrollView style={styles.responseScrollView} nestedScrollEnabled>
              <Text style={styles.responseText}>{result.body}</Text>
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const HTTPTestComponent: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<
    'users' | 'posts' | 'todos' | 'slow' | 'unreliable' | 'create' | 'large'
  >('users');
  const [newPostTitle, setNewPostTitle] = React.useState('');
  const [newPostBody, setNewPostBody] = React.useState('');
  const [useFormData, setUseFormData] = React.useState(false);

  const usersQuery = useUsersQuery();
  const postsQuery = usePostsQuery();
  const todosQuery = useTodosQuery();
  const slowQuery = useSlowDataQuery();
  const unreliableQuery = useUnreliableDataQuery();
  const largeFileQuery = useLargeFileQuery();
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
        postData: {
          title: newPostTitle,
          body: newPostBody,
          userId: 1, // Default user ID
        },
        useFormData,
      },
      {
        onSuccess: () => {
          setNewPostTitle('');
          setNewPostBody('');
          // Switch to posts tab to see the new post
          setActiveTab('posts');
        },
      },
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
      <Text style={styles.title}>HTTP Test</Text>
      <Text style={styles.subtitle}>Testing TanStack Query with real APIs</Text>

      <View style={styles.tabContainer}>
        {[
          { key: 'users', label: 'Users' },
          { key: 'posts', label: 'Posts' },
          { key: 'todos', label: 'Todos' },
          { key: 'slow', label: 'Slow' },
          { key: 'unreliable', label: 'Unreliable' },
          { key: 'create', label: 'Create' },
          { key: 'large', label: 'Large File' },
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
                  | 'large',
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

          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={styles.checkbox}
              onPress={() => setUseFormData(!useFormData)}
            >
              <View
                style={[
                  styles.checkboxBox,
                  useFormData && styles.checkboxBoxChecked,
                ]}
              >
                {useFormData && <Text style={styles.checkboxCheckmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Use FormData</Text>
            </TouchableOpacity>
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
      ) : activeTab === 'large' ? (
        <View style={styles.largeFileContainer}>
          <Text style={styles.largeFileTitle}>Large File Download Test</Text>
          <Text style={styles.largeFileDescription}>
            Download a ~5MB GeoJSON file to test progress events. Watch the
            Network Activity DevTools for progress percentage. Lower the
            emulator&apos;s signal strength for slower downloads to observe
            progress updates.
          </Text>
          <TouchableOpacity
            style={[
              styles.downloadButton,
              largeFileQuery.isFetching && styles.downloadButtonDisabled,
            ]}
            onPress={() => largeFileQuery.refetch()}
            disabled={largeFileQuery.isFetching}
          >
            {largeFileQuery.isFetching ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.downloadButtonText}>Download Large File</Text>
            )}
          </TouchableOpacity>

          {largeFileQuery.isError && (
            <Text style={styles.errorText}>
              Error: {largeFileQuery.error?.message}
            </Text>
          )}

          {largeFileQuery.isSuccess && largeFileQuery.data && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>Download complete!</Text>
              <Text style={styles.fileSizeText}>
                Size: {largeFileQuery.data.byteLength.toLocaleString()} bytes
              </Text>
            </View>
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

  if (activeTab === 'large') {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        >
          {renderHeader()}
        </ScrollView>
      </View>
    );
  }

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
        data={data as User[] | Post[] | Todo[]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader()}
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

const WEBSOCKET_CONFIG = {
  URL: 'wss://echo.websocket.events',
  MESSAGE_INTERVAL: 5000,
  DEFAULT_MESSAGE: 'hello world',
  MAX_MESSAGES_DISPLAY: 10,
} as const;

const NITRO_WEBSOCKET_CONFIG = {
  URL: 'wss://echo.websocket.events',
  DEFAULT_MESSAGE: 'hello from nitro websocket',
  MAX_MESSAGES_DISPLAY: 12,
} as const;

const useWebSocket = (
  url: string,
  messageIntervalMs = WEBSOCKET_CONFIG.MESSAGE_INTERVAL,
) => {
  const [websocket, setWebsocket] = React.useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [messages, setMessages] = React.useState<string[]>([]);
  const [dataType, setDataType] = React.useState<'text' | 'binary' | 'json'>(
    'text',
  );
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const addMessage = React.useCallback((message: string) => {
    setMessages((prev) =>
      [...prev, message].slice(-WEBSOCKET_CONFIG.MAX_MESSAGES_DISPLAY),
    );
  }, []);

  const clearMessages = React.useCallback(() => {
    setMessages([]);
  }, []);

  const sendMessage = React.useCallback(
    (ws: WebSocket, message: string, type: 'text' | 'binary' | 'json') => {
      if (ws.readyState === WebSocket.OPEN) {
        if (type === 'binary') {
          const encoder = new TextEncoder();
          const binaryData = encoder.encode(message);
          ws.send(binaryData);
          addMessage(`Sent binary: ${message}`);
        } else if (type === 'json') {
          const jsonData = JSON.stringify({ message, timestamp: Date.now() });
          ws.send(jsonData);
          addMessage(`Sent JSON: ${jsonData}`);
        } else {
          ws.send(message);
          addMessage(`Sent text: ${message}`);
        }
      }
    },
    [addMessage],
  );

  const startMessageInterval = React.useCallback(
    (ws: WebSocket) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        sendMessage(ws, WEBSOCKET_CONFIG.DEFAULT_MESSAGE, dataType);
      }, messageIntervalMs);
    },
    [sendMessage, dataType, messageIntervalMs],
  );

  const stopMessageInterval = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const connect = React.useCallback(() => {
    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        addMessage('Connected to WebSocket server');
        startMessageInterval(ws);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          addMessage(
            `Received binary: ${String(Array.from(new Uint8Array(event.data)))}`,
          );
        } else {
          addMessage(`Received: ${event.data}`);
        }
      };

      ws.onerror = (error) => {
        addMessage(`Error: ${error}`);
      };

      ws.onclose = () => {
        setIsConnected(false);
        addMessage('Disconnected from WebSocket server');
        stopMessageInterval();
      };

      setWebsocket(ws);
    } catch (error) {
      addMessage(`Connection error: ${error}`);
    }
  }, [url, addMessage, startMessageInterval, stopMessageInterval]);

  const disconnect = React.useCallback(() => {
    if (websocket) {
      websocket.close();
      setWebsocket(null);
    }
    stopMessageInterval();
  }, [websocket, stopMessageInterval]);

  const toggleConnection = React.useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, connect, disconnect]);

  // Update message interval when data type changes
  React.useEffect(() => {
    if (isConnected && websocket) {
      startMessageInterval(websocket);
    }
  }, [dataType, isConnected, websocket, startMessageInterval]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopMessageInterval();
      if (websocket) {
        websocket.close();
      }
    };
  }, [stopMessageInterval, websocket]);

  return {
    isConnected,
    messages,
    dataType,
    setDataType,
    toggleConnection,
    clearMessages,
  };
};

const WebSocketTestComponent: React.FC = () => {
  const scrollViewRef = React.useRef<ScrollView>(null);
  const {
    isConnected,
    messages,
    dataType,
    setDataType,
    toggleConnection,
    clearMessages,
  } = useWebSocket(WEBSOCKET_CONFIG.URL, WEBSOCKET_CONFIG.MESSAGE_INTERVAL);

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      // Use a longer delay to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WebSocket Test</Text>
        <Text style={styles.subtitle}>
          Testing WebSocket connection to echo.websocket.org
        </Text>
      </View>

      <View style={styles.websocketContainer}>
        <View style={styles.websocketControls}>
          <TouchableOpacity
            style={[
              styles.websocketButton,
              isConnected
                ? styles.websocketButtonDisconnect
                : styles.websocketButtonConnect,
            ]}
            onPress={toggleConnection}
          >
            <Text style={styles.websocketButtonText}>
              {isConnected ? 'Disconnect' : 'Connect'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dataTypeContainer}>
            <Text style={styles.dataTypeLabel}>Data Type:</Text>
            <View style={styles.dataTypeButtons}>
              {(['text', 'binary', 'json'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.dataTypeButton,
                    dataType === type && styles.dataTypeButtonActive,
                  ]}
                  onPress={() => setDataType(type)}
                >
                  <Text
                    style={[
                      styles.dataTypeButtonText,
                      dataType === type && styles.dataTypeButtonTextActive,
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.connectionStatus}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusValue,
              { color: isConnected ? '#4CAF50' : '#FF4444' },
            ]}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>

        <View style={styles.messagesContainer}>
          <Text style={styles.messagesTitle}>Messages ({messages.length})</Text>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={true}
          >
            {messages.length === 0 ? (
              <Text style={styles.noMessages}>No messages yet</Text>
            ) : (
              messages
                .slice(-WEBSOCKET_CONFIG.MAX_MESSAGES_DISPLAY)
                .map((message, index) => (
                  <Text key={`${message}-${index}`} style={styles.messageText}>
                    {message}
                  </Text>
                ))
            )}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.clearMessagesButton}
          onPress={clearMessages}
        >
          <Text style={styles.clearMessagesButtonText}>Clear Messages</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const NitroWebSocketTestComponent: React.FC = () => {
  const socketRef = React.useRef<NitroWebSocket | null>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [messages, setMessages] = React.useState<string[]>([]);
  const [message, setMessage] = React.useState<string>(
    NITRO_WEBSOCKET_CONFIG.DEFAULT_MESSAGE,
  );

  const addMessage = React.useCallback((nextMessage: string) => {
    setMessages((prev) =>
      [...prev, nextMessage].slice(
        -NITRO_WEBSOCKET_CONFIG.MAX_MESSAGES_DISPLAY,
      ),
    );
  }, []);

  const connect = React.useCallback(() => {
    if (socketRef.current || isConnecting) {
      return;
    }

    setIsConnecting(true);
    addMessage(`Connecting to ${NITRO_WEBSOCKET_CONFIG.URL}`);

    try {
      const socket = new NitroWebSocket(NITRO_WEBSOCKET_CONFIG.URL);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        addMessage('Nitro socket connected');
      };

      socket.onmessage = (event: NitroWebSocketMessageEvent) => {
        if (event.isBinary && event.binaryData) {
          addMessage(`Received binary (${event.binaryData.byteLength} bytes)`);
          return;
        }

        addMessage(`Received: ${event.data}`);
      };

      socket.onerror = (error: string) => {
        addMessage(`Nitro error: ${error}`);
        setIsConnected(false);
        setIsConnecting(false);
        socketRef.current = null;
      };

      socket.onclose = (event: NitroWebSocketCloseEvent) => {
        addMessage(
          `Nitro socket closed (${event.code}${event.reason ? `: ${event.reason}` : ''})`,
        );
        setIsConnected(false);
        setIsConnecting(false);
        socketRef.current = null;
      };
    } catch (error) {
      addMessage(`Connection error: ${String(error)}`);
      setIsConnecting(false);
      socketRef.current = null;
    }
  }, [addMessage, isConnecting]);

  const disconnect = React.useCallback(() => {
    socketRef.current?.close(1000, 'playground disconnect');
  }, []);

  const send = React.useCallback(() => {
    const socket = socketRef.current;
    const trimmed = message.trim();
    if (!socket || !trimmed || !isConnected) {
      return;
    }

    socket.send(trimmed);
    addMessage(`Sent: ${trimmed}`);
  }, [addMessage, isConnected, message]);

  const clearMessages = React.useCallback(() => {
    setMessages([]);
  }, []);

  React.useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages]);

  React.useEffect(() => {
    return () => {
      socketRef.current?.close(1000, 'screen unmount');
      socketRef.current = null;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nitro WebSocket Test</Text>
        <Text style={styles.subtitle}>
          Testing Nitro WebSocket traffic with a dedicated `Nitro` source in
          Network Activity
        </Text>
      </View>

      <View style={styles.websocketContainer}>
        <View style={styles.websocketControls}>
          <TouchableOpacity
            style={[
              styles.websocketButton,
              isConnected
                ? styles.websocketButtonDisconnect
                : styles.nitroWebSocketButton,
            ]}
            onPress={isConnected ? disconnect : connect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.websocketButtonText}>
                {isConnected ? 'Disconnect' : 'Connect'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dataTypeContainer}>
            <Text style={styles.dataTypeLabel}>Source:</Text>
            <View style={styles.nitroSourcePill}>
              <Text style={styles.nitroSourcePillText}>Nitro WebSocket</Text>
            </View>
          </View>
        </View>

        <View style={styles.connectionStatus}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusValue,
              { color: isConnected ? '#4CAF50' : '#c084fc' },
            ]}
          >
            {isConnected
              ? 'Connected'
              : isConnecting
                ? 'Connecting'
                : 'Disconnected'}
          </Text>
        </View>

        <View style={styles.nitroInputRow}>
          <TextInput
            style={[styles.textInput, styles.nitroMessageInput]}
            value={message}
            onChangeText={setMessage}
            placeholder="Type a Nitro WebSocket message..."
            placeholderTextColor="#666666"
            editable={isConnected}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !isConnected && styles.sendButtonDisabled,
            ]}
            onPress={send}
            disabled={!isConnected}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.messagesContainer}>
          <Text style={styles.messagesTitle}>Messages ({messages.length})</Text>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator
          >
            {messages.length === 0 ? (
              <Text style={styles.noMessages}>
                No Nitro WebSocket messages yet
              </Text>
            ) : (
              messages.map((entry, index) => (
                <Text key={`${entry}-${index}`} style={styles.messageText}>
                  {entry}
                </Text>
              ))
            )}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.clearMessagesButton}
          onPress={clearMessages}
        >
          <Text style={styles.clearMessagesButtonText}>Clear Messages</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SSE_CONFIG = {
  URL: 'https://stream.wikimedia.org/v2/stream/recentchange',
  MAX_MESSAGES_DISPLAY: 15,
} as const;

const useSSE = (url: string) => {
  const [eventSource, setEventSource] = React.useState<EventSource | null>(
    null,
  );
  const [isConnected, setIsConnected] = React.useState(false);
  const [messages, setMessages] = React.useState<string[]>([]);
  const [eventCount, setEventCount] = React.useState(0);

  const addMessage = React.useCallback((message: string) => {
    setMessages((prev) =>
      [...prev, message].slice(-SSE_CONFIG.MAX_MESSAGES_DISPLAY),
    );
    setEventCount((prev) => prev + 1);
  }, []);

  const clearMessages = React.useCallback(() => {
    setMessages([]);
    setEventCount(0);
  }, []);

  const connect = React.useCallback(() => {
    try {
      const es = new EventSource(url);

      es.addEventListener('open', () => {
        setIsConnected(true);
        addMessage('Connected to SSE stream');
      });

      es.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data || '{}');
          const summary = `[${new Date().toLocaleTimeString()}] ${
            data.user || 'Anonymous'
          } edited ${data.title || 'Unknown page'} (${data.type || 'unknown'})`;
          addMessage(summary);
        } catch {
          addMessage(`Raw message: ${event.data}`);
        }
      });

      es.addEventListener('error', (error) => {
        addMessage(`SSE Error: ${error}`);
        setIsConnected(false);
      });

      setEventSource(es);
    } catch (error) {
      addMessage(`Connection error: ${error}`);
    }
  }, [url, addMessage]);

  const disconnect = React.useCallback(() => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      setIsConnected(false);
    }
  }, [eventSource]);

  const toggleConnection = React.useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, connect, disconnect]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  return {
    isConnected,
    messages,
    eventCount,
    toggleConnection,
    clearMessages,
  };
};

const SSETestComponent: React.FC = () => {
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { isConnected, messages, eventCount, toggleConnection, clearMessages } =
    useSSE(SSE_CONFIG.URL);

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      // Use a longer delay to ensure content is rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>SSE Test</Text>
        <Text style={styles.subtitle}>
          Testing Server-Sent Events connection to Wikimedia Recent Changes
        </Text>
      </View>

      <View style={styles.websocketContainer}>
        <View style={styles.websocketControls}>
          <TouchableOpacity
            style={[
              styles.websocketButton,
              isConnected
                ? styles.websocketButtonDisconnect
                : styles.websocketButtonConnect,
            ]}
            onPress={toggleConnection}
          >
            <Text style={styles.websocketButtonText}>
              {isConnected ? 'Disconnect' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.connectionStatus}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text
            style={[
              styles.statusValue,
              { color: isConnected ? '#4CAF50' : '#FF4444' },
            ]}
          >
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>

        <View style={styles.connectionStatus}>
          <Text style={styles.statusLabel}>Events Received:</Text>
          <Text style={styles.statusValue}>{eventCount}</Text>
        </View>

        <View style={styles.messagesContainer}>
          <Text style={styles.messagesTitle}>
            Recent Changes ({messages.length})
          </Text>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={true}
          >
            {messages.length === 0 ? (
              <Text style={styles.noMessages}>No events yet</Text>
            ) : (
              messages
                .slice(-SSE_CONFIG.MAX_MESSAGES_DISPLAY)
                .map((message, index) => (
                  <Text key={`${message}-${index}`} style={styles.messageText}>
                    {message}
                  </Text>
                ))
            )}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.clearMessagesButton}
          onPress={clearMessages}
        >
          <Text style={styles.clearMessagesButtonText}>Clear Events</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const NetworkTestScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [activeTest, setActiveTest] = React.useState<
    'http' | 'nitro' | 'websocket' | 'nitro-websocket' | 'sse' | 'request-body'
  >('http');

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Network Test</Text>
      <Text style={styles.subtitle}>
        Testing built-in HTTP, Nitro HTTP, built-in WebSocket, Nitro WebSocket,
        and SSE connections
      </Text>

      <TouchableOpacity
        style={styles.refetchButton}
        onPress={() => navigation.navigate('RequestBodyTest')}
      >
        <Text style={styles.refetchButtonText}>Request Body Test</Text>
      </TouchableOpacity>

      <View style={styles.mainTabContainer}>
        {[
          { key: 'http', label: 'HTTP Test' },
          { key: 'nitro', label: 'Nitro HTTP' },
          { key: 'websocket', label: 'WebSocket Test' },
          { key: 'nitro-websocket', label: 'Nitro WS' },
          { key: 'sse', label: 'SSE Test' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.mainTab,
              activeTest === tab.key && styles.mainTabActive,
            ]}
            onPress={() =>
              setActiveTest(
                tab.key as
                  | 'http'
                  | 'nitro'
                  | 'websocket'
                  | 'nitro-websocket'
                  | 'sse',
              )
            }
          >
            <Text
              style={[
                styles.mainTabText,
                activeTest === tab.key && styles.mainTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {activeTest === 'http' ? (
        <HTTPTestComponent />
      ) : activeTest === 'nitro' ? (
        <NitroHTTPTestComponent />
      ) : activeTest === 'websocket' ? (
        <WebSocketTestComponent />
      ) : activeTest === 'nitro-websocket' ? (
        <NitroWebSocketTestComponent />
      ) : (
        <SSETestComponent />
      )}
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
    flexWrap: 'wrap',
    marginBottom: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: '22%',
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
  largeFileContainer: {
    marginTop: 20,
  },
  largeFileTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  largeFileDescription: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
    marginBottom: 20,
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadButtonDisabled: {
    backgroundColor: '#666666',
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  fileSizeText: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 4,
    textAlign: 'center',
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#666666',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkboxCheckmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    color: '#ffffff',
    fontSize: 16,
  },
  websocketContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  websocketHeader: {
    marginBottom: 16,
  },
  websocketTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  websocketSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  websocketControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  websocketButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  websocketButtonConnect: {
    backgroundColor: '#007AFF',
  },
  websocketButtonDisconnect: {
    backgroundColor: '#FF4444',
  },
  websocketButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  dataTypeContainer: {
    marginBottom: 16,
    flexGrow: 1,
  },
  dataTypeLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    marginBottom: 8,
  },
  dataTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  dataTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
  },
  dataTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dataTypeButtonText: {
    fontSize: 12,
    color: '#a0a0a0',
    fontWeight: '500',
  },
  dataTypeButtonTextActive: {
    color: '#ffffff',
  },
  connectionStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666666',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  messagesContainer: {
    marginBottom: 16,
  },
  messagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  messagesList: {
    height: 150, // Fixed height for scrolling
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  messagesContent: {
    padding: 10,
  },
  messageText: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 4,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  noMessages: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  clearMessagesButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearMessagesButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  mainTabContainer: {
    flexDirection: 'row',
    marginTop: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  mainTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: '24%',
  },
  mainTabActive: {
    backgroundColor: '#007AFF',
  },
  mainTabText: {
    fontSize: 14,
    color: '#a0a0a0',
    fontWeight: '500',
  },
  mainTabTextActive: {
    color: '#ffffff',
  },
  nitroButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  nitroButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: '46%',
  },
  nitroButtonDanger: {
    backgroundColor: '#d946ef',
  },
  nitroWebSocketButton: {
    backgroundColor: '#8b5cf6',
  },
  nitroButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  nitroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  nitroStatusText: {
    color: '#ffffff',
    fontSize: 14,
  },
  nitroExtraText: {
    color: '#c4b5fd',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  nitroSourcePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#2e1065',
    borderColor: '#8b5cf6',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nitroSourcePillText: {
    color: '#e9d5ff',
    fontSize: 12,
    fontWeight: '600',
  },
  nitroInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  nitroMessageInput: {
    flex: 1,
  },
  sendButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#4b5563',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  formDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  formDataKey: {
    flex: 1,
    minHeight: 40,
  },
  formDataValue: {
    flex: 2,
    minHeight: 40,
  },
  removeFieldButton: {
    backgroundColor: '#FF4444',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeFieldButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addFieldButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  addFieldButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  responseContainer: {
    marginTop: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    padding: 16,
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  responseScrollView: {
    maxHeight: 300,
    backgroundColor: '#0a0a0a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  responseText: {
    fontSize: 12,
    color: '#a0a0a0',
    fontFamily: 'monospace',
    padding: 12,
    lineHeight: 16,
  },
});
