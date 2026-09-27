import { SetMetadata } from '@nestjs/common';

export interface ScopeOptions {
  checkBranch?: boolean;
  checkOrganization?: boolean;
  checkTableResource?: boolean;
  branchParam?: string;
  orgParam?: string;
  tableParam?: string;
}

export const SCOPE_KEY = 'scopeOptions';
export const CheckScope = (options: ScopeOptions = { checkBranch: true, checkOrganization: true }) =>
  SetMetadata(SCOPE_KEY, options);
