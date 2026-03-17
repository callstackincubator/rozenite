const getAggregateErrorMessage = (error: AggregateError): string | null => {
  const nestedMessages = error.errors
    .map((entry) => getErrorMessage(entry))
    .filter((message) => message.length > 0);

  if (nestedMessages.length === 0) {
    return null;
  }

  return nestedMessages.join('; ');
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof AggregateError) {
    const aggregateMessage = getAggregateErrorMessage(error);
    if (aggregateMessage) {
      return aggregateMessage;
    }
  }

  if (error instanceof Error) {
    if (error.message) {
      return error.message;
    }
    return error.name || String(error);
  }

  return String(error);
};
