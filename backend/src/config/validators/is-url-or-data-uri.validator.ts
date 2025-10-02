import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

export const IS_URL_OR_DATA_URI = 'isUrlOrDataUri';

/**
 * Checks if the string is a URL or a Data URI.
 */
export function isUrlOrDataUri(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return /^(https?:\/\/|data:image\/)/.test(value);
}

/**
 * Decorator that checks if a string is a URL or a Data URI.
 */
export function IsUrlOrDataUri(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_URL_OR_DATA_URI,
      validator: {
        // _args se mantiene para compatibilidad con la firma esperada por class-validator
        validate: (value, _args): boolean => isUrlOrDataUri(value),
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + '$property must be a valid URL or a Data URI',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
