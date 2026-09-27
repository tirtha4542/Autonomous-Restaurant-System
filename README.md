# Autonomous Restaurant System (Tavonza Platform)

A full-stack, enterprise-grade Autonomous Restaurant Operating System featuring a NestJS core API, a multi-role operational portal, and an autonomous AI agent runtime (**JARVIS**) powered by Groq LLM and real-time Server-Sent Events (SSE).

---

## 🏛️ System Architecture

```text
                                +-----------------------------------+
                                |     Multi-Role Web Application    |
                                |  Manager • Waiter • Kitchen • QR  |
                                +-----------------+-----------------+
                                                  |
                         +------------------------+------------------------+
                         |                                                 |
                         v                                                 v
           +-----------------------------+                   +-----------------------------+
           |       apps/api (NestJS)     |                   |       apps/ai (Python)      |
           |  - RBAC & ActorContext      | <--- Internal --- |  - JARVIS Agent Runtime     |
           |  - Tables & QR Sessions     |       Client      |  - Groq Model (gpt-oss-120b)|
           |  - Orders & Kitchen KDS     |                   |  - Dynamic Tool Pruning     |
           |  - Outbox SSE Broadcast     |                   |  - Per-Table Memory Store   |
           +--------------+--------------+                   +-----------------------------+
                          |
                          v
           +-----------------------------+
           |     PostgreSQL + Prisma     |
           +-----------------------------+
```

---

## 🚀 Key Modules & Capabilities

### 1. Multi-Role Portals & Scoped Access
- **📱 Customer Portal (QR Scan Only)**: Seated dining experience accessed directly by scanning a Table QR code (e.g. `http://localhost:3000/?table=T1`). No passwords required.
- **👔 Manager Portal**: Executive operational control, table occupancy map, order volumes, and system-wide audit event logs.
- **🍽️ Waiter Portal**: Floor monitoring, active orders for assigned floor tables, and service triggers.
- **👨‍🍳 Kitchen Portal (KDS)**: Real-time ticket management across preparation stations (`grill`, `cold`, `fryer`, `coffee`, `bar`).

### 2. JARVIS AI Assistant with Real-Time Streaming
- **SSE Token Streaming**: Natural token-by-token streaming responses with status indicators during tool execution.
- **Strict Table Isolation**: Table 1 and Table 3 have fully partitioned session IDs, conversation histories, and database scopes. Table 3 can never see or access Table 1's chat history or orders.
- **Dynamic Tool Calling**:
  - `get_menu`: Menu discovery, allergen checks, and dietary filtering.
  - `get_order_status`: Real-time order progress tracking scoped strictly to the customer's active table session.
  - `get_kitchen_queue`: Station-specific pending tickets.
  - `get_branch_summary` & `get_audit_events`: Executive KPIs and compliance logging.

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js**: v18+ (Node 20+ recommended) & `pnpm` (or `npm`)
- **Python**: 3.11+
- **PostgreSQL**: Running locally or remotely

---

### Step 1: Start `apps/api` (Backend & Web UI)

```powershell
cd apps/api
cp .env.example .env
# Ensure DATABASE_URL and JWT_SECRET are set in .env
pnpm install
pnpm prisma:generate
pnpm start:dev
```
- The application will be live at **`http://localhost:3000`**.

---

### Step 2: Start `apps/ai` (JARVIS Agent Runtime)

```powershell
cd apps/ai
python -m venv .venv
.\.venv\Scripts\activate   # On Windows (or 'source .venv/bin/activate' on Linux/macOS)
pip install -r requirements.txt
cp .env.example .env
# Set your GROQ_API_KEY in apps/ai/.env
python -m uvicorn apps.ai.main:app --app-dir . --port 8001 --host 127.0.0.1 --reload
```
- Health endpoint will be available at **`http://localhost:8001/health`**.

---

## 👥 Demo Logins

| Role | Access Method | Credentials | Scope |
| :--- | :--- | :--- | :--- |
| **Customer** | QR Token / Table Selector | *None (QR Scan Only)* | Scoped to individual table |
| **Manager** | Username + Password | `manager` / `password123` | Full branch operations & audit |
| **Waiter** | Username + Password | `waiter` / `password123` | Assigned tables (T1, T2, T3) |
| **Kitchen** | Username + Password | `kitchen` / `password123` | KDS Stations & Tickets |
| **Cashier** | Username + Password | `cashier` / `password123` | Billing, Register & Payments |

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
