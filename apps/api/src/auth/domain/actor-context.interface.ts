export type ActorType = 'USER' | 'AI_AGENT' | 'SYSTEM' | 'INTEGRATION';

export interface ResourceScope {
  tables?: string[];
  station?: string;
  [key: string]: any;
}

export interface ActorContext {
  actor_type: ActorType;
  acting_user_id?: string;
  ai_agent_id?: string;
  organization_id: string;
  restaurant_id?: string;
  branch_id: string;
  permissions: string[];
  resource_scope: ResourceScope;
}
