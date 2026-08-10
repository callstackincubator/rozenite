import { useRozeniteRHFPlugin } from '@rozenite/rhf-plugin';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';
import { Button, Card, Field, Input, PluginHeader, Row, Screen, Switch } from '../components/ui';

type ProfileFormValues = {
  firstName: string;
  email: string;
  newsletter: boolean;
};

export const ReactHookFormPluginScreen = () => {
  const { control, handleSubmit, reset, formState } = useForm<ProfileFormValues>({
    defaultValues: { firstName: '', email: '', newsletter: false },
    mode: 'onChange',
  });

  // Required plugin form id — keep this id stable for the RHF DevTools panel.
  useRozeniteRHFPlugin({ control, id: 'profile-form' });

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
    </Screen>
  );
};
