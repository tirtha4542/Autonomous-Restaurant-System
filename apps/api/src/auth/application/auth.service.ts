import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ActorContext } from '../domain/actor-context.interface';
import { Permissions } from '../domain/permissions';
import { CustomerLoginDto, StaffLoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Issue JWT token for a staff member (waiter, kitchen, manager, etc.)
   */
  async loginStaff(dto: StaffLoginDto): Promise<{ access_token: string; actor: ActorContext }> {
    let employee;

    if (dto.username) {
      const cleanUser = dto.username.trim().toLowerCase();
      // 1. Try matching role name (manager, waiter, kitchen, chef, cashier, bartender, host)
      const roleQuery = cleanUser === 'chef' ? 'kitchen' : cleanUser;
      const roleMatch = await this.prisma.roles.findFirst({
        where: { name: { equals: roleQuery, mode: 'insensitive' } },
      });

      if (roleMatch) {
        employee = await this.prisma.employees.findFirst({
          where: { role_id: roleMatch.id },
          include: {
            roles: true,
            departments: {
              include: {
                branches: {
                  include: {
                    brands: true,
                    dining_tables: true,
                  },
                },
              },
            },
          },
        });
      }

      // 2. If not found by role name, search by employee full name
      if (!employee) {
        employee = await this.prisma.employees.findFirst({
          where: { full_name: { contains: cleanUser, mode: 'insensitive' } },
          include: {
            roles: true,
            departments: {
              include: {
                branches: {
                  include: {
                    brands: true,
                    dining_tables: true,
                  },
                },
              },
            },
          },
        });
      }

      if (!employee) {
        throw new UnauthorizedException(`User '${dto.username}' not found`);
      }

      // Verify password
      if (!dto.password) {
        throw new UnauthorizedException('Password is required');
      }

      const roleName = employee.roles.name.toLowerCase();
      const validPasswords = [
        'password123',
        `${roleName}123`,
        'admin',
        '1234',
        'secret',
      ];
      if (!validPasswords.includes(dto.password.trim())) {
        throw new UnauthorizedException('Invalid username or password');
      }
    } else if (dto.employee_id) {
      employee = await this.prisma.employees.findUnique({
        where: { id: dto.employee_id },
        include: {
          roles: true,
          departments: {
            include: {
              branches: {
                include: {
                  brands: true,
                  dining_tables: true,
                },
              },
            },
          },
        },
      });
    } else if (dto.full_name) {
      employee = await this.prisma.employees.findFirst({
        where: { full_name: { contains: dto.full_name, mode: 'insensitive' } },
        include: {
          roles: true,
          departments: {
            include: {
              branches: {
                include: {
                  brands: true,
                  dining_tables: true,
                },
              },
            },
          },
        },
      });
    } else {
      // Default to first waiter or manager if none specified
      employee = await this.prisma.employees.findFirst({
        include: {
          roles: true,
          departments: {
            include: {
              branches: {
                include: {
                  brands: true,
                  dining_tables: true,
                },
              },
            },
          },
        },
      });
    }

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const branch = employee.departments.branches;
    const brand = branch.brands;
    const tableCodes = branch.dining_tables.map((t) => t.code);
    const rolePermissions = Array.isArray(employee.roles.permissions)
      ? (employee.roles.permissions as string[])
      : [];

    const roleName = employee.roles.name.toLowerCase();
    const additionalPermissions: string[] = [];

    if (roleName === 'manager') {
      additionalPermissions.push(
        Permissions.MENU_READ,
        Permissions.TABLES_READ,
        Permissions.TABLES_WRITE,
        Permissions.ORDERS_READ,
        Permissions.ORDERS_WRITE,
        Permissions.ORDERS_ACCEPT,
        Permissions.ORDERS_REJECT,
        Permissions.PAYMENTS_READ,
        Permissions.PAYMENTS_WRITE,
        Permissions.REPORTS_READ,
        Permissions.STAFF_READ,
        Permissions.ITEMS_WRITE,
        'audit.read',
      );
    } else if (roleName === 'waiter') {
      additionalPermissions.push(
        Permissions.MENU_READ,
        Permissions.TABLES_READ,
        Permissions.TABLES_WRITE,
        Permissions.ORDERS_READ,
        Permissions.ORDERS_WRITE,
        Permissions.ORDERS_SERVE,
      );
    } else if (roleName === 'kitchen') {
      additionalPermissions.push(
        Permissions.ORDERS_READ,
        Permissions.ITEMS_WRITE,
      );
    } else if (roleName === 'cashier') {
      additionalPermissions.push(
        Permissions.PAYMENTS_READ,
        Permissions.PAYMENTS_WRITE,
        Permissions.ORDERS_READ,
        Permissions.TABLES_READ,
        Permissions.TABLES_WRITE,
        Permissions.SESSIONS_READ,
        Permissions.MENU_READ,
      );
    }

    const effectivePermissions = Array.from(
      new Set([...rolePermissions, ...additionalPermissions]),
    );

    const actor: ActorContext = {
      actor_type: 'USER',
      acting_user_id: String(employee.id),
      organization_id: String(brand.organization_id),
      restaurant_id: String(brand.id),
      branch_id: String(branch.id),
      permissions: effectivePermissions,
      resource_scope: {
        tables: tableCodes,
        station: employee.departments.station_type,
      },
    };

    const token = await this.jwtService.signAsync({
      sub: String(employee.id),
      role: employee.roles.name,
      full_name: employee.full_name,
      ...actor,
    });

    return {
      access_token: token,
      actor,
    };
  }

  /**
   * Customer login via QR code token
   */
  async loginCustomer(dto: CustomerLoginDto): Promise<{ access_token: string; actor: ActorContext }> {
    const table = await this.prisma.dining_tables.findUnique({
      where: { qr_token: dto.qr_token },
      include: {
        branches: {
          include: {
            brands: true,
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException(`Invalid QR token: ${dto.qr_token}`);
    }

    const branch = table.branches;
    const brand = branch.brands;

    // Find active table session or create a new one
    let tableSession = await this.prisma.table_sessions.findFirst({
      where: {
        table_id: table.id,
        branch_id: branch.id,
        closed_at: null,
      },
    });

    if (!tableSession) {
      tableSession = await this.prisma.table_sessions.create({
        data: {
          table_id: table.id,
          branch_id: branch.id,
          status: 'active',
          opened_at: new Date(),
        },
      });
    }

    // Create guest session
    const guestSession = await this.prisma.guest_sessions.create({
      data: {
        table_session_id: tableSession.id,
        display_name: dto.display_name?.trim() || `Guest-${table.code}`,
        phone: dto.phone || null,
        otp_verified: true,
        status: 'active',
        dietary_preferences: [],
      },
    });

    const actor: ActorContext = {
      actor_type: 'USER',
      acting_user_id: String(guestSession.id),
      organization_id: String(brand.organization_id),
      restaurant_id: String(brand.id),
      branch_id: String(branch.id),
      permissions: [
        Permissions.ORDERS_READ,
        Permissions.ORDERS_WRITE,
        Permissions.MENU_READ,
        Permissions.SESSIONS_READ,
      ],
      resource_scope: {
        table_id: String(table.id),
        table_code: table.code,
        table_session_id: String(tableSession.id),
        guest_session_id: String(guestSession.id),
        tables: [table.code],
      },
    };

    const token = await this.jwtService.signAsync({
      sub: `guest_${guestSession.id}`,
      ...actor,
    });

    return {
      access_token: token,
      actor,
    };
  }

  /**
   * Resolve an ActorContext from a raw token string or service token
   */
  async resolveActor(token: string): Promise<ActorContext> {
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // 1. Check for Internal Service Token (apps/ai service-to-service)
    const internalSecret = this.configService.get<string>('INTERNAL_API_SERVICE_TOKEN');
    if (internalSecret && token === internalSecret) {
      return {
        actor_type: 'SYSTEM',
        acting_user_id: 'system_service',
        organization_id: '8',
        restaurant_id: '8',
        branch_id: '8',
        permissions: ['*'],
        resource_scope: {},
      };
    }

    // 2. Decode and verify JWT
    try {
      const payload = await this.jwtService.verifyAsync(token);

      // Return strongly-typed ActorContext
      return {
        actor_type: payload.actor_type || 'USER',
        acting_user_id: payload.acting_user_id ? String(payload.acting_user_id) : payload.sub,
        ai_agent_id: payload.ai_agent_id,
        organization_id: String(payload.organization_id),
        restaurant_id: payload.restaurant_id ? String(payload.restaurant_id) : undefined,
        branch_id: String(payload.branch_id),
        permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
        resource_scope: payload.resource_scope || {},
      };
    } catch (err) {
      throw new UnauthorizedException(`Invalid or expired token: ${(err as Error).message}`);
    }
  }

  /**
   * List all staff employees for easy selection in dev/UI
   */
  async listEmployees() {
    return this.prisma.employees.findMany({
      include: {
        roles: true,
        departments: {
          include: {
            branches: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }
}
