import { Button, KeyValueList, PluginHeader, Row, Screen } from '../components/ui';
import { useCartStore, useSessionStore } from '../stores/stateDemoStores';

const SKUS = [
  { sku: 'oat-milk', name: 'Oat milk' },
  { sku: 'bread', name: 'Sourdough' },
  { sku: 'coffee', name: 'Coffee beans' },
];

export const ZustandPluginScreen = () => {
  const lines = useCartStore((state) => state.lines);
  const status = useCartStore((state) => state.status);
  const cart = useCartStore.getState();
  const user = useSessionStore((state) => state.user);
  const loading = useSessionStore((state) => state.loading);
  const profileVersion = useSessionStore((state) => state.profileVersion);
  const session = useSessionStore.getState();

  return (
    <Screen>
      <PluginHeader
        title="Zustand"
        subtitle="Zustand stores wrapped in rozenite(), one of them persisted."
      />

      <KeyValueList
        title="Cart (rozenite + persist)"
        items={[
          { label: 'Cart status', value: status },
          {
            label: 'Cart lines',
            value:
              [...lines.values()].map((line) => `${line.name}×${line.qty}`).join(', ') || '(empty)',
          },
        ]}
      />
      <Row wrap>
        {SKUS.map(({ sku, name }) => (
          <Button
            key={sku}
            size="compact"
            label={`+ ${name}`}
            accessibilityLabel={`Add ${name}`}
            onPress={() => cart.addItem(sku, name)}
          />
        ))}
      </Row>
      <Row wrap>
        <Button
          size="compact"
          label="Qty 5 (milk)"
          accessibilityLabel="Set oat milk quantity to 5"
          onPress={() => cart.setQty('oat-milk', 5)}
        />
        <Button
          size="compact"
          label="Remove milk"
          accessibilityLabel="Remove oat milk"
          onPress={() => cart.removeItem('oat-milk')}
        />
        <Button
          size="compact"
          label="Checkout"
          accessibilityLabel="Checkout cart"
          onPress={() => void cart.checkout()}
        />
        <Button
          size="compact"
          variant="outline"
          label="setState"
          accessibilityLabel="Set cart status from outside the store"
          onPress={() => useCartStore.setState({ status: 'idle' })}
        />
      </Row>

      <KeyValueList
        title="Session (rozenite)"
        items={[
          { label: 'Session user', value: user ? `${user.name} #${user.id}` : '(signed out)' },
          { label: 'Session loading', value: String(loading) },
          { label: 'Profile version', value: String(profileVersion) },
        ]}
      />
      <Row>
        <Button
          size="compact"
          label="Log in"
          accessibilityLabel="Log in as Ada"
          onPress={() => void session.login('Ada')}
        />
        <Button
          size="compact"
          label="Login + refresh"
          accessibilityLabel="Log in and refresh profile concurrently"
          onPress={() => {
            void session.login('Grace');
            void session.refreshProfile();
          }}
        />
        <Button
          size="compact"
          variant="destructive"
          label="Log out"
          accessibilityLabel="Log out"
          onPress={() => session.logout()}
        />
      </Row>
    </Screen>
  );
};
