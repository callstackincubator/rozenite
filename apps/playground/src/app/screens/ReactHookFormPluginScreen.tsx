import { useRozeniteRHFPlugin } from '@rozenite/rhf-plugin';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  age: string;
  bio: string;
  newsletter: boolean;
  address: {
    street: string;
    city: string;
    zip: string;
  };
};

type LoginFormValues = {
  username: string;
  password: string;
};

function ProfileForm() {
  const { control, handleSubmit, reset, formState } = useForm<ProfileFormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      age: '',
      bio: '',
      newsletter: false,
      address: {
        street: '',
        city: '',
        zip: '',
      },
    },
    mode: 'onChange',
  });

  useRozeniteRHFPlugin({ control, id: 'profile-form' });

  const onSubmit = (data: ProfileFormValues) => {
    Alert.alert('Submitted', JSON.stringify(data, null, 2));
  };

  return (
    <View style={styles.formSection}>
      <Text style={styles.formTitle}>Profile Form</Text>

      <Controller
        control={control}
        name="firstName"
        rules={{ required: 'First name is required', minLength: { value: 2, message: 'Min 2 chars' } }}
        render={({ field, fieldState }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={[styles.input, fieldState.error && styles.inputError]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="John"
              placeholderTextColor="#666"
            />
            {fieldState.error && (
              <Text style={styles.errorText}>{fieldState.error.message}</Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="lastName"
        rules={{ required: 'Last name is required' }}
        render={({ field, fieldState }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={[styles.input, fieldState.error && styles.inputError]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="Doe"
              placeholderTextColor="#666"
            />
            {fieldState.error && (
              <Text style={styles.errorText}>{fieldState.error.message}</Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="email"
        rules={{
          required: 'Email is required',
          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
        }}
        render={({ field, fieldState }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={[styles.input, fieldState.error && styles.inputError]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="john@example.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {fieldState.error && (
              <Text style={styles.errorText}>{fieldState.error.message}</Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="age"
        rules={{
          min: { value: 18, message: 'Must be 18+' },
          max: { value: 120, message: 'Invalid age' },
        }}
        render={({ field, fieldState }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Age</Text>
            <TextInput
              style={[styles.input, fieldState.error && styles.inputError]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="25"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            {fieldState.error && (
              <Text style={styles.errorText}>{fieldState.error.message}</Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="bio"
        render={({ field }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
            />
          </View>
        )}
      />

      <Text style={styles.sectionLabel}>Address</Text>

      <Controller
        control={control}
        name="address.street"
        rules={{ required: 'Street is required' }}
        render={({ field, fieldState }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Street *</Text>
            <TextInput
              style={[styles.input, fieldState.error && styles.inputError]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="123 Main St"
              placeholderTextColor="#666"
            />
            {fieldState.error && (
              <Text style={styles.errorText}>{fieldState.error.message}</Text>
            )}
          </View>
        )}
      />

      <View style={styles.row}>
        <Controller
          control={control}
          name="address.city"
          rules={{ required: 'City is required' }}
          render={({ field, fieldState }) => (
            <View style={[styles.fieldContainer, styles.flex]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={[styles.input, fieldState.error && styles.inputError]}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="New York"
                placeholderTextColor="#666"
              />
              {fieldState.error && (
                <Text style={styles.errorText}>{fieldState.error.message}</Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="address.zip"
          rules={{ pattern: { value: /^\d{5}$/, message: '5 digits' } }}
          render={({ field, fieldState }) => (
            <View style={[styles.fieldContainer, styles.zipField]}>
              <Text style={styles.label}>ZIP</Text>
              <TextInput
                style={[styles.input, fieldState.error && styles.inputError]}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="10001"
                placeholderTextColor="#666"
                keyboardType="numeric"
                maxLength={5}
              />
              {fieldState.error && (
                <Text style={styles.errorText}>{fieldState.error.message}</Text>
              )}
            </View>
          )}
        />
      </View>

      <Controller
        control={control}
        name="newsletter"
        render={({ field }) => (
          <View style={[styles.fieldContainer, styles.switchRow]}>
            <Text style={styles.label}>Subscribe to newsletter</Text>
            <Switch value={field.value} onValueChange={field.onChange} />
          </View>
        )}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => reset()}
        >
          <Text style={styles.buttonSecondaryText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, !formState.isValid && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
        >
          <Text style={styles.buttonPrimaryText}>Submit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LoginForm() {
  const { control, handleSubmit, formState } = useForm<LoginFormValues>({
    defaultValues: { username: '', password: '' },
    mode: 'onBlur',
  });

  useRozeniteRHFPlugin({ control, id: 'login-form' });

  const onSubmit = (data: LoginFormValues) => {
    Alert.alert('Login', `Welcome, ${data.username}!`);
  };

  return (
    <View style={styles.formSection}>
      <Text style={styles.formTitle}>Login Form</Text>

      <Controller
        control={control}
        name="username"
        rules={{ required: 'Username required', minLength: { value: 3, message: 'Min 3 chars' } }}
        render={({ field, fieldState }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Username *</Text>
            <TextInput
              style={[styles.input, fieldState.error && styles.inputError]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="username"
              placeholderTextColor="#666"
              autoCapitalize="none"
            />
            {fieldState.error && (
              <Text style={styles.errorText}>{fieldState.error.message}</Text>
            )}
          </View>
        )}
      />

      <Controller
        control={control}
        name="password"
        rules={{ required: 'Password required', minLength: { value: 8, message: 'Min 8 chars' } }}
        render={({ field, fieldState }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={[styles.input, fieldState.error && styles.inputError]}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="••••••••"
              placeholderTextColor="#666"
              secureTextEntry
            />
            {fieldState.error && (
              <Text style={styles.errorText}>{fieldState.error.message}</Text>
            )}
          </View>
        )}
      />

      <TouchableOpacity
        style={[styles.button, styles.buttonPrimary, formState.isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit(onSubmit)}
      >
        <Text style={styles.buttonPrimaryText}>
          {formState.isSubmitting ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function ReactHookFormPluginScreen() {
  const [activeForm, setActiveForm] = useState<'profile' | 'login'>('profile');
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: Math.max(insets.bottom, 40) },
      ]}
    >
      <Text style={styles.screenTitle}>React Hook Form Plugin</Text>
      <Text style={styles.screenSubtitle}>
        Open the DevTools panel to inspect form state in real time
      </Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeForm === 'profile' && styles.tabActive]}
          onPress={() => setActiveForm('profile')}
        >
          <Text style={[styles.tabText, activeForm === 'profile' && styles.tabTextActive]}>
            Profile Form
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeForm === 'login' && styles.tabActive]}
          onPress={() => setActiveForm('login')}
        >
          <Text style={[styles.tabText, activeForm === 'login' && styles.tabTextActive]}>
            Login Form
          </Text>
        </TouchableOpacity>
      </View>

      {activeForm === 'profile' ? <ProfileForm /> : <LoginForm />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
  },
  tabRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: '#8232FF',
  },
  tabText: {
    color: '#888',
    fontWeight: '500',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  formSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: '#8232FF',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  zipField: {
    width: 90,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#8232FF',
  },
  buttonSecondary: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonSecondaryText: {
    color: '#ccc',
    fontWeight: '500',
    fontSize: 15,
  },
});
