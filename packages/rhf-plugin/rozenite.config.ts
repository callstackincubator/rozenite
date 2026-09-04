type DevFlowContext = {
  send: (type: string, payload: unknown) => void;
  waitForMessage: (
    matcher: { type?: string; direction?: 'in' | 'out' },
    options?: { timeoutMs?: number },
  ) => Promise<{ payload: unknown }>;
};

const contactFormSnapshot = {
  id: 'contactForm',
  formValues: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    'address.street': '123 Main St',
    'address.city': 'Springfield',
    'items.0.name': 'Item A',
    'items.1.name': 'Item B',
  },
  formState: {
    errors: {},
    dirtyFields: {
      'address.street': true,
      'address.city': true,
      'items.0.name': true,
    },
    touchedFields: {
      name: true,
      email: true,
      'address.street': true,
      'address.city': true,
    },
    nativeFields: {
      name: 'text',
      email: 'email',
      'address.street': 'text',
      'address.city': 'text',
      'items.0.name': 'text',
      'items.1.name': 'text',
    },
    submitCount: 1,
    isSubmitted: true,
    isSubmitting: false,
    isSubmitSuccessful: true,
    isValid: true,
    isValidating: false,
    isDirty: true,
  },
};

const paymentFormSnapshot = {
  id: 'paymentForm',
  formValues: {
    'payment.email': 'not-an-email',
    'payment.cardNumber': '',
  },
  formState: {
    errors: {
      'payment.email': { type: 'pattern', message: 'Enter a valid email address' },
      'payment.cardNumber': { type: 'required', message: 'Card number is required' },
    },
    dirtyFields: {
      'payment.email': true,
    },
    touchedFields: {
      'payment.email': true,
      'payment.cardNumber': true,
    },
    nativeFields: {
      'payment.email': 'email',
      'payment.cardNumber': 'text',
    },
    submitCount: 2,
    isSubmitted: true,
    isSubmitting: false,
    isSubmitSuccessful: false,
    isValid: false,
    isValidating: false,
    isDirty: true,
  },
};

export default {
  integrations: ['react-native', 'react-native-web', 'lynx', 'lynx-web'],
  panels: [
    {
      name: 'React Hook Form',
      source: './src/ui/panel.tsx',
    },
  ],
  // `useRozeniteRHFPlugin` is called once per form inside ordinary screen
  // components, so it needs a touchpoint that survives a production build.
  // See `register.ts`.
  productionEntries: ['./register'],
  dev: {
    flows: [
      {
        name: 'Initialize RHF fixtures',
        autoRun: true,
        run: async ({ send, waitForMessage }: DevFlowContext) => {
          await waitForMessage({ type: 'init', direction: 'out' }, { timeoutMs: 10000 });

          send('update', { type: 'update', snapshot: contactFormSnapshot });
          send('update', { type: 'update', snapshot: paymentFormSnapshot });

          return {
            message: 'Initialized contactForm and paymentForm fixtures.',
            forms: 2,
          };
        },
      },
      {
        name: 'Handle reset-form request',
        autoRun: true,
        run: async ({ send, waitForMessage }: DevFlowContext) => {
          const { payload } = await waitForMessage(
            { type: 'reset-form', direction: 'out' },
            { timeoutMs: 60000 },
          );
          const { requestId, id } = payload as { requestId: string; id: string };

          send('reset-form-result', { type: 'reset-form-result', requestId, id });

          const source = id === contactFormSnapshot.id ? contactFormSnapshot : paymentFormSnapshot;
          send('update', {
            type: 'update',
            snapshot: {
              ...source,
              formValues: Object.fromEntries(
                Object.keys(source.formValues).map((key) => [key, '']),
              ),
              formState: {
                ...source.formState,
                errors: {},
                dirtyFields: {},
                touchedFields: {},
                isDirty: false,
                isValid: false,
              },
            },
          });

          return { message: `Simulated remote reset for "${id}".`, requestId };
        },
      },
    ],
  },
};
