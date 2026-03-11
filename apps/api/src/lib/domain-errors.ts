/**
 * Domain Error Types — Base class and shared error types for domain services.
 *
 * Each service defines its own specific errors extending DomainError.
 * Tool handlers catch these and translate to ToolResult objects.
 */

import type { ToolErrorCode } from '@agentic-bank/shared';

export class DomainError extends Error {
  code: ToolErrorCode;

  constructor(code: ToolErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export class InsufficientFundsError extends DomainError {
  balance: number;
  requested: number;

  constructor(balance: number, requested: number) {
    super(
      'INSUFFICIENT_FUNDS',
      `Insufficient funds: balance £${balance.toFixed(2)}, requested £${requested.toFixed(2)}`,
    );
    this.name = 'InsufficientFundsError';
    this.balance = balance;
    this.requested = requested;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}
