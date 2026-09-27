import { ActorContext } from '../../auth/domain/actor-context.interface';

export interface ToolResult {
  ok: boolean;
  data?: Record<string, any>;
  pending_confirmation_id?: string;
  error?: string;
}

export interface ExecuteToolParams {
  tool: string;
  args: Record<string, any>;
  scope: {
    organization_id: string;
    branch_id: string;
  };
  actor: ActorContext;
}
