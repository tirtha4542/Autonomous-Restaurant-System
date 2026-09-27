import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../../outbox/application/outbox.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ActorContext } from '../../auth/domain/actor-context.interface';

export interface BillItem {
  id: number;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  station: string;
  status: string;
}

export interface TableBill {
  session_id: number;
  table_id: number;
  table_code: string;
  opened_at: Date;
  guests_count: number;
  orders_count: number;
  items: BillItem[];
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  balance_due: number;
  payment_status: 'UNPAID' | 'PARTIAL' | 'SETTLED';
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Get all active dining sessions with computed bills for Cashier desk
   */
  async getPendingBills(branchId: number): Promise<TableBill[]> {
    const sessions = await this.prisma.table_sessions.findMany({
      where: {
        branch_id: branchId,
        closed_at: null,
      },
      include: {
        dining_tables: true,
        guest_sessions: true,
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
      orderBy: { id: 'desc' },
    });

    return sessions.map((session) => this.computeSessionBill(session));
  }

  /**
   * Get itemized bill for a specific table session
   */
  async getTableBill(sessionId: number, branchId: number): Promise<TableBill> {
    const session = await this.prisma.table_sessions.findFirst({
      where: {
        id: sessionId,
        branch_id: branchId,
      },
      include: {
        dining_tables: true,
        guest_sessions: true,
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
    });

    if (!session) {
      throw new NotFoundException(`Table session #${sessionId} not found in branch #${branchId}`);
    }

    return this.computeSessionBill(session);
  }

  /**
   * Process a payment (Cash, Card, Digital Wallet) and optionally close the table session
   */
  async processPayment(dto: ProcessPaymentDto, actor: ActorContext) {
    const branchId = Number(actor.branch_id);

    const session = await this.prisma.table_sessions.findFirst({
      where: {
        id: dto.table_session_id,
        branch_id: branchId,
      },
      include: {
        dining_tables: true,
        guest_sessions: true,
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
    });

    if (!session) {
      throw new NotFoundException(`Table session #${dto.table_session_id} not found in branch #${branchId}`);
    }

    let targetOrderId = dto.order_id;
    if (!targetOrderId) {
      const activeOrder = session.orders.find((o) => o.status !== 'REJECTED');
      if (activeOrder) {
        targetOrderId = activeOrder.id;
      } else if (session.orders.length > 0) {
        targetOrderId = session.orders[0].id;
      } else {
        // Create order record for this session so the payment can attach cleanly
        const firstGuestId = session.guest_sessions[0]?.id || null;
        const autoOrder = await this.prisma.orders.create({
          data: {
            table_session_id: session.id,
            guest_session_id: firstGuestId,
            is_shared: true,
            status: 'SERVED',
          },
        });
        targetOrderId = autoOrder.id;
      }
    }

    const firstGuestId = session.guest_sessions[0]?.id || null;

    // Create settled payment record
    const payment = await this.prisma.payments.create({
      data: {
        order_id: targetOrderId,
        guest_session_id: firstGuestId,
        amount: dto.amount,
        status: 'settled',
        method: dto.method,
      },
    });

    // Record Outbox Event for Realtime Broadcast
    await this.outboxService.emitPaymentSettled({
      paymentId: payment.id,
      tableSessionId: session.id,
      tableCode: session.dining_tables.code,
      amount: Number(dto.amount),
      method: dto.method,
      branchId,
    });

    // Write audit log
    await this.prisma.audit_logs.create({
      data: {
        branch_id: branchId,
        actor_role: 'cashier',
        event_type: 'payment.settled',
        payload: {
          payment_id: payment.id,
          table_session_id: session.id,
          table_code: session.dining_tables.code,
          amount: dto.amount,
          method: dto.method,
          cashier_id: actor.acting_user_id,
        },
        created_at: new Date(),
      },
    });

    let sessionClosed = false;

    // If requested or if fully settled and close_session requested
    if (dto.close_session) {
      await this.prisma.table_sessions.update({
        where: { id: session.id },
        data: {
          status: 'closed',
          closed_at: new Date(),
        },
      });

      // Free up dining table
      await this.prisma.dining_tables.update({
        where: { id: session.table_id },
        data: { status: 'available' },
      });

      await this.outboxService.emitSessionClosed({
        tableSessionId: session.id,
        tableCode: session.dining_tables.code,
        branchId,
      });

      sessionClosed = true;
    }

    // Return receipt
    const updatedBill = await this.getTableBill(session.id, branchId);

    return {
      ok: true,
      receipt_id: `RCP_${payment.id}_${Date.now().toString().slice(-4)}`,
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status,
        timestamp: new Date().toISOString(),
      },
      table: {
        id: session.table_id,
        code: session.dining_tables.code,
      },
      session_id: session.id,
      session_closed: sessionClosed,
      bill_summary: {
        total: updatedBill.total,
        paid_amount: updatedBill.paid_amount,
        balance_due: updatedBill.balance_due,
        payment_status: updatedBill.payment_status,
      },
    };
  }

  /**
   * Recent payment transaction history
   */
  async getPaymentHistory(branchId: number) {
    const payments = await this.prisma.payments.findMany({
      where: {
        orders: {
          table_sessions: {
            branch_id: branchId,
          },
        },
      },
      include: {
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
      orderBy: { id: 'desc' },
      take: 25,
    });

    return payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      status: p.status,
      method: p.method,
      order_id: p.order_id,
      table_code: p.orders?.table_sessions?.dining_tables?.code || 'Unknown',
      session_id: p.orders?.table_session_id,
    }));
  }

  /**
   * Calculate bill details for a table session
   */
  private computeSessionBill(session: any): TableBill {
    const items: BillItem[] = [];
    let subtotal = 0;
    let totalPaid = 0;

    for (const order of session.orders || []) {
      for (const oi of order.order_items || []) {
        const unitPrice = Number(oi.menu_items?.price || 0);
        const lineTotal = Number((unitPrice * oi.quantity).toFixed(2));
        subtotal += lineTotal;

        items.push({
          id: oi.id,
          name: oi.menu_items?.name || 'Item',
          quantity: oi.quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          station: oi.station,
          status: oi.status,
        });
      }

      for (const p of order.payments || []) {
        if (p.status === 'settled') {
          totalPaid += Number(p.amount);
        }
      }
    }

    subtotal = Number(subtotal.toFixed(2));
    const tax = Number((subtotal * 0.1).toFixed(2)); // 10% standard tax
    const total = Number((subtotal + tax).toFixed(2));
    totalPaid = Number(totalPaid.toFixed(2));
    const balanceDue = Math.max(0, Number((total - totalPaid).toFixed(2)));

    let paymentStatus: 'UNPAID' | 'PARTIAL' | 'SETTLED' = 'UNPAID';
    if (total > 0 && totalPaid >= total) {
      paymentStatus = 'SETTLED';
    } else if (totalPaid > 0) {
      paymentStatus = 'PARTIAL';
    }

    return {
      session_id: session.id,
      table_id: session.table_id,
      table_code: session.dining_tables?.code || 'T?',
      opened_at: session.opened_at,
      guests_count: session.guest_sessions?.length || 1,
      orders_count: session.orders?.length || 0,
      items,
      subtotal,
      tax,
      total,
      paid_amount: totalPaid,
      balance_due: balanceDue,
      payment_status: paymentStatus,
    };
  }
}
