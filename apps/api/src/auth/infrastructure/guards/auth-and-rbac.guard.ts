import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../../application/auth.service';
import { ActorType } from '../../domain/actor-context.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ACTOR_TYPES_KEY } from '../decorators/actor-type.decorator';
import { SCOPE_KEY, ScopeOptions } from '../decorators/scope.decorator';

@Injectable()
export class AuthAndRbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { actor?: any }>();
    const token = this.extractTokenFromHeader(request);

    // If endpoint is marked public and has no token, allow through immediately
    if (isPublic && !token) {
      return true;
    }

    // 1. Resolve Actor
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required: Missing Bearer token');
    }

    try {
      const actor = await this.authService.resolveActor(token);
      request.actor = actor;
      (request as any).user = actor;

      if (isPublic) {
        return true;
      }

      // 2. Check Actor Type
      const requiredActorTypes = this.reflector.getAllAndOverride<ActorType[]>(ACTOR_TYPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (requiredActorTypes && requiredActorTypes.length > 0) {
        if (!requiredActorTypes.includes(actor.actor_type)) {
          throw new ForbiddenException(
            `Forbidden: Actor type '${actor.actor_type}' is not authorized for this resource`,
          );
        }
      }

      // 3. Check Permissions
      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasWildcard = actor.permissions.includes('*');
        if (!hasWildcard) {
          const missingPermissions = requiredPermissions.filter(
            (perm) => !actor.permissions.includes(perm),
          );

          if (missingPermissions.length > 0) {
            throw new ForbiddenException(
              `Forbidden: Missing required permission(s): ${missingPermissions.join(', ')}`,
            );
          }
        }
      }

      // 4. Check Scope (Organization, Branch)
      const scopeOptions = this.reflector.getAllAndOverride<ScopeOptions>(SCOPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || { checkBranch: true, checkOrganization: true };

      const params = request.params || {};
      const query = request.query || {};
      const body = request.body || {};

      // Organization Scope Check
      if (scopeOptions.checkOrganization !== false && actor.actor_type !== 'SYSTEM') {
        const requestedOrg =
          params.organizationId ||
          params.organization_id ||
          query.organization_id ||
          body.organization_id;

        if (requestedOrg && String(requestedOrg) !== String(actor.organization_id)) {
          throw new ForbiddenException(
            `Tenant isolation violation: Actor belongs to organization ${actor.organization_id} but requested organization ${requestedOrg}`,
          );
        }
      }

      // Branch Scope Check
      if (scopeOptions.checkBranch !== false && actor.actor_type !== 'SYSTEM') {
        const requestedBranch =
          params.branchId || params.branch_id || query.branch_id || body.branch_id;

        if (requestedBranch && String(requestedBranch) !== String(actor.branch_id)) {
          throw new ForbiddenException(
            `Branch scope violation: Actor belongs to branch ${actor.branch_id} but requested branch ${requestedBranch}`,
          );
        }
      }

      // 5. Check Resource Scope (e.g. Tables)
      const requestedTable =
        params.tableId ||
        params.table_id ||
        params.table ||
        query.table ||
        body.table_id ||
        body.table_code;

      if (requestedTable && actor.resource_scope) {
        const allowedTables = actor.resource_scope.tables;
        const allowedTableId = actor.resource_scope.table_id;

        if (allowedTables && Array.isArray(allowedTables) && allowedTables.length > 0) {
          const isAllowed =
            allowedTables.includes(String(requestedTable)) ||
            (allowedTableId && String(allowedTableId) === String(requestedTable));

          if (!isAllowed) {
            throw new ForbiddenException(
              `Resource scope violation: Table '${requestedTable}' is not in actor assigned resource scope`,
            );
          }
        }
      }

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof UnauthorizedException) {
        throw err;
      }
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException(`Authorization failed: ${(err as Error).message}`);
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
