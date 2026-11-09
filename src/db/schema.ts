import { pgTable, serial, text, timestamp, integer, doublePrecision } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table linked directly to Firebase UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  balance: doublePrecision('balance').default(0).notNull(),
  tier: text('tier').default('Gold').notNull(),
  streakDays: integer('streak_days').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Completed Task History table
export const completedTasks = pgTable('completed_tasks', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull(),
  taskId: text('task_id').notNull(),
  taskTitle: text('task_title').notNull(),
  category: text('category').notNull(),
  reward: doublePrecision('reward').notNull(),
  status: text('status').default('Approved').notNull(),
  accuracyScore: doublePrecision('accuracy_score').default(100.0).notNull(),
  transactionRef: text('transaction_ref').notNull(),
  completedAt: timestamp('completed_at').defaultNow(),
});

// Referrals table
export const referrals = pgTable('referrals', {
  id: serial('id').primaryKey(),
  referrerUid: text('referrer_uid')
    .references(() => users.uid)
    .notNull(),
  refereeName: text('referee_name').notNull(),
  refereeEmailMasked: text('referee_email_masked').notNull(),
  refereeCountry: text('referee_country').notNull(),
  passPurchased: text('pass_purchased').notNull(),
  passPrice: doublePrecision('pass_price').notNull(),
  commissionEarned: doublePrecision('commission_earned').notNull(),
  paymentMethod: text('payment_method').notNull(),
  status: text('status').default('Credited').notNull(),
  transactionId: text('transaction_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Payouts table
export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .references(() => users.uid)
    .notNull(),
  amount: doublePrecision('amount').notNull(),
  method: text('method').notNull(),
  accountDetails: text('account_details').notNull(),
  status: text('status').default('Completed').notNull(),
  mpesaReceipt: text('mpesa_receipt'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(completedTasks),
  referrals: many(referrals),
  payouts: many(payouts),
}));

export const completedTasksRelations = relations(completedTasks, ({ one }) => ({
  user: one(users, {
    fields: [completedTasks.userUid],
    references: [users.uid],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerUid],
    references: [users.uid],
  }),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  user: one(users, {
    fields: [payouts.userUid],
    references: [users.uid],
  }),
}));
