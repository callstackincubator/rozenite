import { Provider, useDispatch, useSelector } from 'react-redux';
import { Button, Card, KeyValueRow, PluginHeader, Row, Screen } from '../components/ui';
import { decrement, increment, reset } from '../store/counterSlice';
import { primaryStore, secondaryStore, RootState } from '../store';

type CounterCardProps = {
  title: string;
};

const CounterCard = ({ title }: CounterCardProps) => {
  const dispatch = useDispatch();
  const count = useSelector((state: RootState) => state.counter.value);

  return (
    <Card>
      <KeyValueRow label={title} value={String(count)} />
      <Row>
        <Button
          label="-1"
          accessibilityLabel={`Decrement ${title}`}
          variant="destructive"
          onPress={() => dispatch(decrement())}
        />
        <Button
          label="+1"
          accessibilityLabel={`Increment ${title}`}
          onPress={() => dispatch(increment())}
        />
        <Button
          label="Reset"
          accessibilityLabel={`Reset ${title}`}
          variant="secondary"
          onPress={() => dispatch(reset())}
        />
      </Row>
    </Card>
  );
};

export const ReduxTestScreen = () => {
  return (
    <Screen>
      <PluginHeader
        title="Redux"
        subtitle="Two independent stores. Switch instances in Redux DevTools to inspect each."
      />
      <Provider store={primaryStore}>
        <CounterCard title="Primary store counter" />
      </Provider>
      <Provider store={secondaryStore}>
        <CounterCard title="Secondary store counter" />
      </Provider>
    </Screen>
  );
};
