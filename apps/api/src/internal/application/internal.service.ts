import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/application/auth.service';
import { ActorContext } from '../../auth/domain/actor-context.interface';
import { AuditRecordDto, ConfirmToolDto, ExecuteToolDto } from './dto/internal.dto';
import { ToolResult } from '../domain/tool.interface';

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * 1) POST /internal/auth/resolve-actor
   * Resolves raw JWT token into ActorContext for apps/ai
   */
  async resolveActor(token: string): Promise<ActorContext> {
    return this.authService.resolveActor(token);
  }

  /**
   * 2) GET /internal/context/bootstrap
   * Returns operational snapshot (assigned tables, active sessions, branch info)
   */
  async getBootstrapContext(actorId?: string, branchId?: string) {
    const targetBranchId = branchId ? Number(branchId) : 8;

    const branch = await this.prisma.branches.findUnique({
      where: { id: targetBranchId },
      include: {
        dining_tables: true,
      },
    });

    const tables = branch?.dining_tables.map((t) => t.code) || ['T1', 'T2', 'T3'];

    const activeSessions = await this.prisma.table_sessions.findMany({
      where: {
        branch_id: targetBranchId,
        closed_at: null,
      },
      select: {
        id: true,
        status: true,
        table_id: true,
      },
      take: 10,
    });

    return {
      assigned_tables: tables,
      active_sessions: activeSessions.map((s) => `TS_${s.id}`),
      branch: branch
        ? {
            id: branch.id,
            name: branch.name,
            timezone: branch.timezone,
          }
        : { id: targetBranchId, name: 'HQ', timezone: 'UTC' },
    };
  }

  /**
   * 3) POST /internal/tools/execute
   * Executes Tool Gateway operations on behalf of AI / internal client
   */
  async executeTool(dto: ExecuteToolDto): Promise<ToolResult> {
    const { tool, args, scope, actor } = dto;
    const branchId = Number(scope?.branch_id || actor?.branch_id || 8);

    this.logger.log(`Executing internal tool '${tool}' for actor '${actor?.acting_user_id || actor?.ai_agent_id}'`);

    switch (tool) {
      case 'get_menu': {
        const menuItems = await this.prisma.menu_items.findMany({
          where: { branch_id: branchId },
          orderBy: { id: 'asc' },
        });

        const items = menuItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: Number(item.price),
          category: item.station,
          station: item.station,
          allergens: item.allergens,
          image_url: item.image_url,
        }));

        return {
          ok: true,
          data: { items },
        };
      }

      case 'get_table_status': {
        const tableIdentifier = String(args.table_id || args.code || '');
        const table = await this.prisma.dining_tables.findFirst({
          where: {
            branch_id: branchId,
            OR: [
              { code: tableIdentifier },
              ...(isNaN(Number(tableIdentifier)) ? [] : [{ id: Number(tableIdentifier) }]),
            ],
          },
        });

        if (!table) {
          return {
            ok: true,
            data: {
              table_id: tableIdentifier,
              status: 'UNKNOWN',
            },
          };
        }

        return {
          ok: true,
          data: {
            table_id: table.code,
            id: table.id,
            status: table.status.toUpperCase(),
            capacity: table.capacity,
          },
        };
      }

      case 'get_order_status': {
        const orderId = args.order_id ? Number(args.order_id) : null;
        const customerTableCode = actor?.resource_scope?.table_code;
        const customerSessionId = actor?.resource_scope?.table_session_id
          ? Number(actor.resource_scope.table_session_id)
          : null;

        let order;

        if (orderId && !isNaN(orderId)) {
          order = await this.prisma.orders.findUnique({
            where: { id: orderId },
            include: {
              order_items: {
                include: {
                  menu_items: true,
                },
              },
              table_sessions: {
                include: {
                  dining_tables: true,
                },
              },
            },
          });

          // Enforce resource scope: if actor is a customer at a table, they cannot see other tables' orders!
          if (customerTableCode && order && order.table_sessions.dining_tables.code !== customerTableCode) {
            return {
              ok: false,
              error: `Order #${orderId} does not belong to your table (${customerTableCode}).`,
            };
          }
        } else if (customerSessionId) {
          // If order_id not given and customer is asking about their table order
          order = await this.prisma.orders.findFirst({
            where: {
              table_session_id: customerSessionId,
              status: { notIn: ['SERVED', 'REJECTED'] },
            },
            orderBy: { id: 'desc' },
            include: {
              order_items: {
                include: {
                  menu_items: true,
                },
              },
              table_sessions: {
                include: {
                  dining_tables: true,
                },
              },
            },
          });
        }

        if (!order) {
          return {
            ok: false,
            error: customerTableCode
              ? `No active orders found for Table ${customerTableCode}.`
              : `Order not found.`,
          };
        }

        return {
          ok: true,
          data: {
            order_id: order.id,
            status: order.status,
            table: order.table_sessions.dining_tables.code,
            items: order.order_items.map((oi) => ({
              id: oi.id,
              name: oi.menu_items.name,
              quantity: oi.quantity,
              status: oi.status,
            })),
          },
        };
      }

      case 'get_kitchen_queue': {
        const stationFilter = args.station ? String(args.station).toLowerCase() : undefined;
        const activeItems = await this.prisma.order_items.findMany({
          where: {
            orders: {
              table_sessions: {
                branch_id: branchId,
              },
              status: { notIn: ['SERVED', 'REJECTED'] },
            },
            status: { notIn: ['READY', 'SERVED'] },
            ...(stationFilter ? { station: stationFilter } : {}),
          },
          include: {
            menu_items: true,
            orders: {
              include: {
                table_sessions: {
                  include: {
                    dining_tables: true,
                  },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
          take: 20,
        });

        return {
          ok: true,
          data: {
            station: stationFilter || 'ALL',
            pending_count: activeItems.length,
            items: activeItems.map((item) => ({
              item_id: item.id,
              order_id: item.order_id,
              table: item.orders.table_sessions.dining_tables.code,
              name: item.menu_items.name,
              station: item.station,
              quantity: item.quantity,
              status: item.status,
              modifiers: item.modifiers,
            })),
          },
        };
      }

      case 'get_branch_summary': {
        const [totalTables, activeSessions, activeOrders, auditCount] = await Promise.all([
          this.prisma.dining_tables.count({ where: { branch_id: branchId } }),
          this.prisma.table_sessions.count({ where: { branch_id: branchId, closed_at: null } }),
          this.prisma.orders.count({
            where: {
              table_sessions: { branch_id: branchId },
              status: { notIn: ['SERVED', 'REJECTED'] },
            },
          }),
          this.prisma.audit_logs.count({ where: { branch_id: branchId } }),
        ]);

        return {
          ok: true,
          data: {
            branch_id: branchId,
            total_tables: totalTables,
            occupied_tables: activeSessions,
            available_tables: Math.max(0, totalTables - activeSessions),
            active_orders: activeOrders,
            total_audit_events: auditCount,
          },
        };
      }

      case 'get_audit_events': {
        const logs = await this.prisma.audit_logs.findMany({
          where: { branch_id: branchId },
          orderBy: { id: 'desc' },
          take: 10,
        });

        return {
          ok: true,
          data: {
            count: logs.length,
            events: logs.map((log) => ({
              id: log.id,
              actor: log.actor_role,
              event: log.event_type,
              payload: log.payload,
              time: log.created_at,
            })),
          },
        };
      }

      case 'get_table_bill': {
        const tableIdentifier = String(args.table_id || args.code || '');
        const table = await this.prisma.dining_tables.findFirst({
          where: {
            branch_id: branchId,
            OR: [
              { code: tableIdentifier },
              ...(isNaN(Number(tableIdentifier)) ? [] : [{ id: Number(tableIdentifier) }]),
            ],
          },
          include: {
            table_sessions: {
              where: { closed_at: null },
              include: {
                orders: {
                  include: {
                    order_items: {
                      include: {
                        menu_items: true,
                      },
                    },
                    payments: true,
                  },
                },
              },
              take: 1,
            },
          },
        });

        if (!table || table.table_sessions.length === 0) {
          return {
            ok: false,
            error: `No active dining session found for table '${tableIdentifier}'`,
          };
        }

        const session = table.table_sessions[0];
        let subtotal = 0;
        let totalPaid = 0;
        const items: Array<{ name: string; quantity: number; price: number; line_total: number }> = [];

        for (const order of session.orders) {
          for (const oi of order.order_items) {
            const unitPrice = Number(oi.menu_items?.price || 0);
            const lineTotal = Number((unitPrice * oi.quantity).toFixed(2));
            subtotal += lineTotal;
            items.push({
              name: oi.menu_items?.name || 'Item',
              quantity: oi.quantity,
              price: unitPrice,
              line_total: lineTotal,
            });
          }
          for (const p of order.payments) {
            if (p.status === 'settled') {
              totalPaid += Number(p.amount);
            }
          }
        }

        subtotal = Number(subtotal.toFixed(2));
        const tax = Number((subtotal * 0.1).toFixed(2));
        const total = Number((subtotal + tax).toFixed(2));
        totalPaid = Number(totalPaid.toFixed(2));
        const balanceDue = Math.max(0, Number((total - totalPaid).toFixed(2)));

        return {
          ok: true,
          data: {
            table_code: table.code,
            session_id: session.id,
            items_count: items.length,
            items,
            subtotal,
            tax,
            total,
            paid_amount: totalPaid,
            balance_due: balanceDue,
            status: totalPaid >= total && total > 0 ? 'SETTLED' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID',
          },
        };
      }

      default: {
        return {
          ok: false,
          error: `Tool '${tool}' is not recognized or not implemented yet`,
        };
      }
    }
  }

  /**
   * 4) POST /internal/tools/execute/confirm
   * Second step of high-risk confirmation handshake
   */
  async confirmTool(dto: ConfirmToolDto): Promise<ToolResult> {
    return {
      ok: true,
      data: {
        confirmed: true,
        pending_confirmation_id: dto.pending_confirmation_id,
      },
    };
  }

  /**
   * 5) POST /internal/audit
   * Ingests structured audit records into PostgreSQL audit_logs table
   */
  async writeAudit(record: AuditRecordDto): Promise<void> {
    try {
      const branchId = record.branchId ? Number(record.branchId) : null;
      await this.prisma.audit_logs.create({
        data: {
          branch_id: branchId,
          actor_role: record.actorType || 'AI_AGENT',
          event_type: record.action || 'ai.audit',
          payload: record as any,
          created_at: record.timestamp ? new Date(record.timestamp) : new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to persist audit log: ${(err as Error).message}`, (err as Error).stack);
    }
  }
}
