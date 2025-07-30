import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface ConfigItem {
  id: string;
  title: string;
  type: 'toggle' | 'number';
  value: boolean | number;
  onValueChange: (value: boolean | number) => void;
  placeholder?: string;
}

interface ConfigSection {
  title: string;
  data: ConfigItem[];
}

export const ConfigScreen = () => {
  const navigation = useNavigation();
  const configSections: ConfigSection[] = [
    {
      title: 'TanStack Query DevTools',
      data: [],
    },
  ];

  const renderItem = ({ item }: { item: ConfigItem }) => {
    if (item.type === 'toggle') {
      return (
        <View style={styles.configItem}>
          <Text style={styles.configItemTitle}>{item.title}</Text>
          <Switch
            value={item.value as boolean}
            onValueChange={item.onValueChange as (value: boolean) => void}
            trackColor={{ false: '#767577', true: '#8232FF' }}
            thumbColor={(item.value as boolean) ? '#f4f3f4' : '#f4f3f4'}
          />
        </View>
      );
    }

    if (item.type === 'number') {
      return (
        <View style={styles.configItem}>
          <Text style={styles.configItemTitle}>{item.title}</Text>
          <TextInput
            style={styles.numberInput}
            value={String(item.value)}
            onChangeText={(text) => item.onValueChange(Number(text) || 0)}
            placeholder={item.placeholder}
            keyboardType="numeric"
            placeholderTextColor="#666"
          />
        </View>
      );
    }

    return null;
  };

  const renderSectionHeader = ({ section }: { section: ConfigSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plugin Configuration</Text>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
      <SectionList
        sections={configSections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        style={styles.sectionList}
        contentContainerStyle={styles.sectionListContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionList: {
    flex: 1,
  },
  sectionListContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8232FF',
  },
  configItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  configItemTitle: {
    fontSize: 16,
    color: '#ffffff',
    flex: 1,
  },
  numberInput: {
    backgroundColor: '#333',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 16,
    minWidth: 80,
    textAlign: 'center',
  },
});
