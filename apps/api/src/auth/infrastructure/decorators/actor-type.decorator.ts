import { SetMetadata } from '@nestjs/common';
import { ActorType } from '../../domain/actor-context.interface';

export const ACTOR_TYPES_KEY = 'actorTypes';
export const RequireActorType = (...types: ActorType[]) =>
  SetMetadata(ACTOR_TYPES_KEY, types);
