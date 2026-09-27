import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ActorContext } from '../../../auth/domain/actor-context.interface';

export class ResolveActorDto {
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class ExecuteToolDto {
  @IsNotEmpty()
  @IsString()
  tool: string;

  @IsObject()
  args: Record<string, any>;

  @IsObject()
  scope: {
    organization_id: string;
    branch_id: string;
  };

  @IsObject()
  actor: ActorContext;
}

export class ConfirmToolDto {
  @IsNotEmpty()
  @IsString()
  pending_confirmation_id: string;

  @IsObject()
  actor: ActorContext;
}

export class AuditRecordDto {
  @IsOptional()
  @IsString()
  actorType?: string;

  @IsOptional()
  @IsString()
  actingUserId?: string;

  @IsOptional()
  @IsString()
  aiAgentId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsNotEmpty()
  @IsString()
  action: string;

  @IsOptional()
  resource?: any;

  @IsOptional()
  before?: any;

  @IsOptional()
  after?: any;

  @IsOptional()
  @IsString()
  authorizationResult?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
