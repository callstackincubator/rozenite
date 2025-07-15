export type DomainMessageListener = (message: JSONValue) => void;

export type JSONValue =
  | null
  | string
  | number
  | boolean
  | { [key: string]: JSONValue }
  | JSONValue[];
