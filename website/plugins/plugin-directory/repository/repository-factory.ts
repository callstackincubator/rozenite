import { PluginRepository } from './types';

let repository: Promise<PluginRepository> | PluginRepository | null = null;

export const getRepository = async (): Promise<PluginRepository> => {
  if (repository) {
    return repository;
  }

  if (process.env.NODE_ENV === 'production') {
    repository = import('./neon-repository').then(
      ({ PostgresPluginRepository }) => new PostgresPluginRepository()
    );
    console.log('Using Neon repository');
    return repository;
  }

  repository = import('./mock-repository').then(
    ({ MockPluginRepository }) => new MockPluginRepository()
  );
  console.log('Using mock repository');
  return repository;
};
