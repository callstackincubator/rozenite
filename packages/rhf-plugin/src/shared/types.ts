export type FieldError = {
  type?: string;
  message?: string;
};

export type FormSnapshot = {
  id: string;
  formValues: Record<string, unknown>;
  formState: {
    errors: Record<string, FieldError>;
    dirtyFields: Record<string, boolean>;
    touchedFields: Record<string, boolean>;
    nativeFields: Record<string, string | undefined>;
    submitCount: number;
    isSubmitted: boolean;
    isSubmitting: boolean;
    isSubmitSuccessful: boolean;
    isValid: boolean;
    isValidating: boolean;
    isDirty: boolean;
  };
};
