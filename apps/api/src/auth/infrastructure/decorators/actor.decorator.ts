import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ActorContext } from '../../domain/actor-context.interface';

export const Actor = createParamDecorator(
  (data: keyof ActorContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const actor: ActorContext = request.actor;

    return data && actor ? actor[data] : actor;
  },
);

export const CurrentActor = Actor;
