import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type SupportTicketStatus = 'Open' | 'Resolved';

export interface CustomerSupportTicket {
  id: string;
  userUid?: string;
  customerName: string;
  contactInfo: string;
  countryCode: string;
  category: string;
  subject: string;
  message: string;
  aiConversationSummary?: string;
  status: SupportTicketStatus;
  ownerReply?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const TICKETS_FILE = path.join(DATA_DIR, 'support-tickets.json');

const ticketsById = new Map<string, CustomerSupportTicket>();

function persistTicketsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const items = Array.from(ticketsById.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist support tickets store:', (err as Error)?.message || err);
  }
}

function loadTicketsFromDisk() {
  try {
    if (!fs.existsSync(TICKETS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item?.id) {
          ticketsById.set(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load support tickets store:', (err as Error)?.message || err);
  }
}

loadTicketsFromDisk();

export function createSupportTicket(params: {
  userUid?: string;
  customerName: string;
  contactInfo: string;
  countryCode?: string;
  category?: string;
  subject?: string;
  message: string;
  aiConversationSummary?: string;
}): CustomerSupportTicket {
  const customerName = String(params.customerName || '').trim().slice(0, 100);
  const contactInfo = String(params.contactInfo || '').trim().slice(0, 160);
  const message = String(params.message || '').trim().slice(0, 2000);

  if (customerName.length < 2) {
    throw new Error('Please enter your name (at least 2 characters).');
  }
  if (contactInfo.length < 5) {
    throw new Error('Please enter a valid email address or mobile number so Gideon can reply.');
  }
  if (message.length < 8) {
    throw new Error('Please describe your issue clearly (at least 8 characters).');
  }

  const nowIso = new Date().toISOString();
  const id = `SUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const ticket: CustomerSupportTicket = {
    id,
    userUid: params.userUid ? String(params.userUid).trim().slice(0, 128) : undefined,
    customerName,
    contactInfo,
    countryCode: String(params.countryCode || 'KE').trim().toUpperCase().slice(0, 4),
    category: String(params.category || 'General Support').trim().slice(0, 60),
    subject: String(params.subject || 'Customer Assistance Request').trim().slice(0, 140),
    message,
    aiConversationSummary: params.aiConversationSummary
      ? String(params.aiConversationSummary).trim().slice(0, 1500)
      : undefined,
    status: 'Open',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  ticketsById.set(ticket.id, ticket);
  persistTicketsToDisk();
  return ticket;
}

export function listAllSupportTickets(): CustomerSupportTicket[] {
  return Array.from(ticketsById.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function updateSupportTicket(params: {
  id: string;
  status?: SupportTicketStatus;
  ownerReply?: string;
}): CustomerSupportTicket {
  const existing = ticketsById.get(params.id);
  if (!existing) {
    throw new Error('Support ticket not found.');
  }
  if (params.status === 'Open' || params.status === 'Resolved') {
    existing.status = params.status;
  }
  if (typeof params.ownerReply === 'string') {
    existing.ownerReply = params.ownerReply.trim().slice(0, 1000);
  }
  existing.updatedAt = new Date().toISOString();
  ticketsById.set(existing.id, existing);
  persistTicketsToDisk();
  return existing;
}
