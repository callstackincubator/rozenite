import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, type Post, type User } from './utils/network-activity/api';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      setUsers(await api.getUsers());
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Failed to load users',
      );
    } finally {
      setLoading(false);
    }
  };

  const createTestPost = async () => {
    setLoading(true);
    setError(null);

    try {
      setPost(
        await api.createPost({
          title: 'Webpack web smoke test',
          body: 'Testing the React Native Web webpack setup.',
          userId: 1,
        }),
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Failed to create post',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>React Native Web</Text>
        <Text style={styles.title}>Playground webpack smoke test</Text>
        <Text style={styles.description}>
          This uses `webpack` plus `react-native-web` against the existing
          `src/main.tsx` entry.
        </Text>

        <View style={styles.actions}>
          <Pressable onPress={loadUsers} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Load users</Text>
          </Pressable>
          <Pressable onPress={createTestPost} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Create test post</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator color="#8b5cf6" />
            <Text style={styles.muted}>Running request...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Request failed</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {post ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Latest created post</Text>
            <Text style={styles.cardTitle}>{post.title}</Text>
            <Text style={styles.cardText}>{post.body}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fetched users</Text>
          {users.length === 0 ? (
            <Text style={styles.muted}>No users loaded yet.</Text>
          ) : (
            users.map((user) => (
              <View key={user.id} style={styles.userRow}>
                <Text style={styles.cardTitle}>{user.name}</Text>
                <Text style={styles.cardText}>{user.email}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1020',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    gap: 16,
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
  },
  eyebrow: {
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 36,
    fontWeight: '800',
  },
  description: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 640,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButton: {
    backgroundColor: '#111827',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 10,
    padding: 20,
  },
  errorCard: {
    backgroundColor: '#3f1d2e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    gap: 8,
    padding: 20,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#fecaca',
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: '#fee2e2',
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  cardText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: '#94a3b8',
    fontSize: 14,
  },
  userRow: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 12,
  },
});
