import { describe, expect, it } from 'vitest';
import { parseStack } from '../parse';

describe('parseStack', () => {
  it('parses V8 function frames', () => {
    expect(
      parseStack(
        'Error\n    at dispatchAction (http://localhost:8081/index.bundle:123:45)',
      ),
    ).toEqual([
      {
        functionName: 'dispatchAction',
        generatedUrl: 'http://localhost:8081/index.bundle',
        generatedLineNumber: 123,
        generatedColumnNumber: 45,
      },
    ]);
  });

  it('parses JavaScriptCore frames', () => {
    expect(
      parseStack(
        'dispatchAction@http://localhost:8081/index.bundle?platform=ios:123:45',
      ),
    ).toEqual([
      {
        functionName: 'dispatchAction',
        generatedUrl: 'http://localhost:8081/index.bundle?platform=ios',
        generatedLineNumber: 123,
        generatedColumnNumber: 45,
      },
    ]);
  });
});
