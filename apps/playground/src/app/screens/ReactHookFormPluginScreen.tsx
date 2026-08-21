// Called beside useForm() below and needs that form's control/reset, so it
// cannot be hoisted into the dev entry — `/register` is the declared
// production entry the build-time guard permits here.
import { useRozeniteRHFPlugin } from '@rozenite/rhf-plugin/register';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Text } from 'react-native';
import { Button, Card, Field, Input, PluginHeader, Row, Screen, Switch } from '../components/ui';
import { useTheme } from '../theme/useTheme';

type ProfileFormValues = {
  firstName: string;
  email: string;
  newsletter: boolean;
  address: {
    street: string;
    // Two levels of nesting under `address`: `address.location.city` and
    // `address.location.zip` exercise the DevTools panel's field tree.
    location: {
      city: string;
      zip: string;
    };
  };
};

export const ReactHookFormPluginScreen = () => {
  const { theme } = useTheme();
  const { control, handleSubmit, reset, formState } = useForm<ProfileFormValues>({
    defaultValues: {
      firstName: '',
      email: '',
      newsletter: false,
      address: { street: '', location: { city: '', zip: '' } },
    },
    mode: 'onChange',
  });

  // Required plugin form id — keep this id stable for the RHF DevTools panel.
  // `reset` lets the DevTools panel revert this form remotely.
  useRozeniteRHFPlugin({ control, id: 'profile-form', reset });

  const onSubmit = (data: ProfileFormValues) => {
    Alert.alert('Submitted', JSON.stringify(data, null, 2));
  };

  return (
    <Screen>
      <PluginHeader
        title="React Hook Form"
        subtitle="Inspect form state live from the RHF DevTools panel."
      />

      <Card>
        <Controller
          control={control}
          name="firstName"
          rules={{
            required: 'First name is required',
            minLength: { value: 2, message: 'Min 2 chars' },
          }}
          render={({ field, fieldState }) => (
            <Field label="First name" error={fieldState.error?.message}>
              <Input
                accessibilityLabel="First name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Ada"
              />
            </Field>
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
            <Field label="Email" error={fieldState.error?.message}>
              <Input
                accessibilityLabel="Email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="ada@rozenite.dev"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="newsletter"
          render={({ field }) => (
            <Row>
              <Field label="Newsletter">
                <Switch
                  value={field.value}
                  onValueChange={field.onChange}
                  accessibilityLabel="Subscribe to newsletter"
                />
              </Field>
            </Row>
          )}
        />

        <Row>
          <Button label="Reset" variant="secondary" onPress={() => reset()} />
          <Button label="Submit" disabled={!formState.isValid} onPress={handleSubmit(onSubmit)} />
        </Row>
      </Card>

      <Card>
        <Text style={{ color: theme.colors.mutedForeground, fontSize: theme.fontSize.xs }}>
          Address (nested fields)
        </Text>

        <Controller
          control={control}
          name="address.street"
          render={({ field, fieldState }) => (
            <Field label="Street" error={fieldState.error?.message}>
              <Input
                accessibilityLabel="Street"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="123 Main St"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="address.location.city"
          render={({ field, fieldState }) => (
            <Field label="City" error={fieldState.error?.message}>
              <Input
                accessibilityLabel="City"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="Springfield"
              />
            </Field>
          )}
        />

        <Controller
          control={control}
          name="address.location.zip"
          rules={{
            pattern: { value: /^\d{5}$/, message: '5 digits' },
          }}
          render={({ field, fieldState }) => (
            <Field label="ZIP" error={fieldState.error?.message}>
              <Input
                accessibilityLabel="ZIP"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="12345"
                keyboardType="number-pad"
              />
            </Field>
          )}
        />
      </Card>
    </Screen>
  );
};
