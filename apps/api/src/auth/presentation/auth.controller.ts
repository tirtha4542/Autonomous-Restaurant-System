import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import { CustomerLoginDto, StaffLoginDto } from '../application/dto/login.dto';
import { Public } from '../infrastructure/decorators/public.decorator';
import { Actor } from '../infrastructure/decorators/actor.decorator';
import { ActorContext } from '../domain/actor-context.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async loginStaff(@Body() dto: StaffLoginDto) {
    return this.authService.loginStaff(dto);
  }

  @Public()
  @Post('customer')
  async loginCustomer(@Body() dto: CustomerLoginDto) {
    return this.authService.loginCustomer(dto);
  }

  @Public()
  @Get('employees')
  async listEmployees() {
    return this.authService.listEmployees();
  }

  @Public()
  @Post('resolve-actor')
  async resolveActor(@Body() body: { token: string }) {
    return this.authService.resolveActor(body.token);
  }

  @Get('me')
  async getMe(@Actor() actor: ActorContext) {
    return { actor };
  }
}
