import type { ToolError } from '@agentic-bank/shared';

export function toolError(
  code: ToolError['code'],
  message: string
): ToolError {
  return { error: true, code, message };
}

export function providerUnavailable(provider: string = 'Banking'): ToolError {
  return toolError(
    'PROVIDER_UNAVAILABLE',
    `${provider} service temporarily unavailable. Please try again.`
  );
}

export function validationError(message: string): ToolError {
  return toolError('VALIDATION_ERROR', message);
}

export function notFoundError(message: string): ToolError {
  return toolError('NOT_FOUND', message);
}

export function forbiddenError(): ToolError {
  return toolError('FORBIDDEN', 'You do not have permission to perform this action.');
}

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}
