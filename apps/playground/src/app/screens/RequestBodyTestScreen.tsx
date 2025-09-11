import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/types';

const MIRROR_API = 'https://httpbun.com/post';

const requestBodyApi = {
  testStringBody: async (data: string): Promise<any> => {
    const response = await fetch(MIRROR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'X-Rozenite-Test': 'true',
      },
      body: data,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  testJsonBody: async (data: any): Promise<any> => {
    const response = await fetch(MIRROR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rozenite-Test': 'true',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  testFormDataBody: async (data: Record<string, string>): Promise<any> => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(MIRROR_API, {
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

  testBinaryBody: async (data: Uint8Array): Promise<any> => {
    const response = await fetch(MIRROR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Rozenite-Test': 'true',
      },
      body: data,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};

const useRequestBodyTestMutations = () => {
  return {
    stringTest: useMutation({
      mutationFn: requestBodyApi.testStringBody,
    }),
    jsonTest: useMutation({
      mutationFn: requestBodyApi.testJsonBody,
    }),
    formDataTest: useMutation({
      mutationFn: requestBodyApi.testFormDataBody,
    }),
    binaryTest: useMutation({
      mutationFn: requestBodyApi.testBinaryBody,
    }),
  };
};

export const RequestBodyTestScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  // Request body test states
  const [requestBodyType, setRequestBodyType] = React.useState<
    'string' | 'json' | 'formdata' | 'binary'
  >('string');
  const [stringBodyData, setStringBodyData] = React.useState(
    'Hello, this is a test string!'
  );
  const [jsonBodyData, setJsonBodyData] = React.useState(
    '{\n  "message": "Hello World",\n  "timestamp": "2024-01-01T00:00:00Z",\n  "user": {\n    "id": 123,\n    "name": "Test User"\n  }\n}'
  );
  const [formDataFields, setFormDataFields] = React.useState<
    Record<string, string>
  >({
    name: 'John Doe',
    email: 'john@example.com',
    message: 'This is a form data test',
  });
  const [binaryData, setBinaryData] = React.useState(
    'Binary test data - this will be converted to Uint8Array'
  );
  const [requestBodyResponse, setRequestBodyResponse] =
    React.useState<any>(null);

  const requestBodyMutations = useRequestBodyTestMutations();

  const handleRequestBodyTest = () => {
    setRequestBodyResponse(null); // Clear previous response

    switch (requestBodyType) {
      case 'string': {
        requestBodyMutations.stringTest.mutate(stringBodyData, {
          onSuccess: (data) => setRequestBodyResponse(data),
        });
        break;
      }
      case 'json': {
        try {
          const parsedJson = JSON.parse(jsonBodyData);
          requestBodyMutations.jsonTest.mutate(parsedJson, {
            onSuccess: (data) => setRequestBodyResponse(data),
          });
        } catch {
          setRequestBodyResponse({ error: 'Invalid JSON format' });
        }
        break;
      }
      case 'formdata': {
        requestBodyMutations.formDataTest.mutate(formDataFields, {
          onSuccess: (data) => setRequestBodyResponse(data),
        });
        break;
      }
      case 'binary': {
        const encoder = new TextEncoder();
        const binaryArray = encoder.encode(binaryData);
        requestBodyMutations.binaryTest.mutate(binaryArray, {
          onSuccess: (data) => setRequestBodyResponse(data),
        });
        break;
      }
    }
  };

  const updateFormDataField = (key: string, value: string) => {
    setFormDataFields((prev) => ({ ...prev, [key]: value }));
  };

  const addFormDataField = () => {
    const newKey = `field${Object.keys(formDataFields).length + 1}`;
    setFormDataFields((prev) => ({ ...prev, [newKey]: '' }));
  };

  const removeFormDataField = (key: string) => {
    setFormDataFields((prev) => {
      const newFields = { ...prev };
      delete newFields[key];
      return newFields;
    });
  };

  const isLoading =
    requestBodyMutations.stringTest.isPending ||
    requestBodyMutations.jsonTest.isPending ||
    requestBodyMutations.formDataTest.isPending ||
    requestBodyMutations.binaryTest.isPending;

  const error =
    requestBodyMutations.stringTest.error ||
    requestBodyMutations.jsonTest.error ||
    requestBodyMutations.formDataTest.error ||
    requestBodyMutations.binaryTest.error;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Request Body Test</Text>
        <Text style={styles.subtitle}>
          Test different request body types using {MIRROR_API}
        </Text>
      </View>

      <View style={styles.form}>
        {/* Request Body Type Selector */}
        <View style={styles.dataTypeContainer}>
          <Text style={styles.dataTypeLabel}>Request Body Type:</Text>
          <View style={styles.dataTypeButtons}>
            {(['string', 'json', 'formdata', 'binary'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.dataTypeButton,
                  requestBodyType === type && styles.dataTypeButtonActive,
                ]}
                onPress={() => setRequestBodyType(type)}
              >
                <Text
                  style={[
                    styles.dataTypeButtonText,
                    requestBodyType === type && styles.dataTypeButtonTextActive,
                  ]}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* String Body Input */}
        {requestBodyType === 'string' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>String Data</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={stringBodyData}
              onChangeText={setStringBodyData}
              placeholder="Enter string data..."
              placeholderTextColor="#666666"
              multiline
              numberOfLines={4}
            />
          </View>
        )}

        {/* JSON Body Input */}
        {requestBodyType === 'json' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>JSON Data</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={jsonBodyData}
              onChangeText={setJsonBodyData}
              placeholder="Enter valid JSON..."
              placeholderTextColor="#666666"
              multiline
              numberOfLines={6}
            />
          </View>
        )}

        {/* Form Data Input */}
        {requestBodyType === 'formdata' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Form Data Fields</Text>
            {Object.entries(formDataFields).map(([key, value]) => (
              <View key={key} style={styles.formDataRow}>
                <TextInput
                  style={[styles.textInput, styles.formDataKey]}
                  value={key}
                  onChangeText={(newKey) => {
                    if (newKey !== key) {
                      const newFields = { ...formDataFields };
                      delete newFields[key];
                      newFields[newKey] = value;
                      setFormDataFields(newFields);
                    }
                  }}
                  placeholder="Field name"
                  placeholderTextColor="#666666"
                />
                <TextInput
                  style={[styles.textInput, styles.formDataValue]}
                  value={value}
                  onChangeText={(newValue) =>
                    updateFormDataField(key, newValue)
                  }
                  placeholder="Field value"
                  placeholderTextColor="#666666"
                />
                <TouchableOpacity
                  style={styles.removeFieldButton}
                  onPress={() => removeFormDataField(key)}
                >
                  <Text style={styles.removeFieldButtonText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addFieldButton}
              onPress={addFormDataField}
            >
              <Text style={styles.addFieldButtonText}>+ Add Field</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Binary Body Input */}
        {requestBodyType === 'binary' && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              Binary Data (as text - will be converted to Uint8Array)
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={binaryData}
              onChangeText={setBinaryData}
              placeholder="Enter text that will be converted to binary..."
              placeholderTextColor="#666666"
              multiline
              numberOfLines={4}
            />
          </View>
        )}

        {/* Send Request Button */}
        <TouchableOpacity
          style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
          onPress={handleRequestBodyTest}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.sendButtonText}>
              Send{' '}
              {requestBodyType.charAt(0).toUpperCase() +
                requestBodyType.slice(1)}{' '}
              Request
            </Text>
          )}
        </TouchableOpacity>

        {/* Error Display */}
        {error && <Text style={styles.errorText}>Error: {error.message}</Text>}

        {/* Response Display */}
        {requestBodyResponse && (
          <View style={styles.responseContainer}>
            <Text style={styles.responseTitle}>Response from httpbin.org:</Text>
            <ScrollView style={styles.responseScrollView}>
              <Text style={styles.responseText}>
                {JSON.stringify(requestBodyResponse, null, 2)}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  contentContainer: {
    paddingBottom: 20,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
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
  form: {
    paddingHorizontal: 20,
  },
  dataTypeContainer: {
    marginBottom: 24,
  },
  dataTypeLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 12,
  },
  dataTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  dataTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  dataTypeButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  dataTypeButtonText: {
    fontSize: 14,
    color: '#a0a0a0',
    fontWeight: '500',
  },
  dataTypeButtonTextActive: {
    color: '#ffffff',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
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
  sendButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#666666',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
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
