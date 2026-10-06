import {
  pgTable, text, integer, numeric, boolean, timestamp, jsonb, index, uniqueIndex, pgEnum,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'editor', 'viewer']);
export const userStatusEnum = pgEnum('user_status', ['pending', 'approved', 'denied']);
export const productStatusEnum = pgEnum('product_status', ['ativo', 'inativo']);
export const txTypeEnum = pgEnum('tx_type', ['in', 'out']);
export const osStatusEnum = pgEnum('os_status', ['draft', 'in_progress', 'completed', 'paid']);
export const accessReqStatusEnum = pgEnum('access_req_status', ['pending', 'approved', 'rejected']);

const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: 'number' });
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export interface Permissions {
  canManageInventory: boolean;
  canManageOS: boolean;
  canManageUsers: boolean;
  canViewReports: boolean;
  canPerformTransactions: boolean;
}

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Cognito sub (ou UID Firebase antes do primeiro login pós-migração)
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull().default('viewer'),
  status: userStatusEnum('status').notNull().default('pending'),
  permissions: jsonb('permissions').$type<Permissions>(),
  photoUrl: text('photo_url'),
  legacyFirebaseUid: text('legacy_firebase_uid'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('users_email_uq').on(t.email)]);

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  aiSuggestion: text('ai_suggestion'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('categories_name_uq').on(t.name)]);

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  sku: text('sku'),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'), // nome da categoria, igual ao modelo atual
  price: money('price'),
  laborCost: money('labor_cost'),
  quantity: integer('quantity').notNull().default(0),
  minQuantity: integer('min_quantity').notNull().default(0),
  status: productStatusEnum('status').notNull().default('ativo'),
  imageUrl: text('image_url'),
  observation: text('observation'),
  expirationDate: text('expiration_date'),
  batch: text('batch'),
  supplier: text('supplier'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('products_name_idx').on(t.name), index('products_category_idx').on(t.category)]);

// Sem FK para products: histórico sobrevive à exclusão do produto.
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  type: txTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason'),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('tx_timestamp_idx').on(t.timestamp), index('tx_product_idx').on(t.productId)]);

export interface ServiceOrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  laborCost: number;
  total: number;
  observation?: string;
}

export const serviceOrders = pgTable('service_orders', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  vehicleModel: text('vehicle_model'),
  vehiclePlate: text('vehicle_plate'),
  items: jsonb('items').$type<ServiceOrderItem[]>().notNull().default([]),
  generalLaborCost: money('general_labor_cost').notNull().default(0),
  totalLaborCost: money('total_labor_cost').notNull().default(0),
  totalPartsCost: money('total_parts_cost').notNull().default(0),
  totalAmount: money('total_amount').notNull().default(0),
  status: osStatusEnum('status').notNull().default('draft'),
  scheduledDate: text('scheduled_date').notNull(),
  completionDate: text('completion_date'),
  observations: text('observations'),
  createdBy: text('created_by').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('os_created_idx').on(t.createdAt)]);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  productId: text('product_id'),
  type: text('type').notNull().default('low_stock'),
  read: boolean('read').notNull().default(false),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notif_unread_idx').on(t.productId, t.read, t.type)]);

export const settings = pgTable('settings', {
  id: text('id').primaryKey(), // 'global'
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: updatedAt(),
});

export const accessRequests = pgTable('access_requests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  workshopName: text('workshop_name').notNull(),
  phone: text('phone'),
  message: text('message'),
  status: accessReqStatusEnum('status').notNull().default('pending'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});

export const aiSearches = pgTable('ai_searches', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  query: text('query').notNull(),
  response: text('response').notNull(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('ai_user_idx').on(t.userId, t.timestamp)]);

export const backups = pgTable('backups', {
  id: text('id').primaryKey(),
  productCount: integer('product_count').notNull(),
  transactionCount: integer('transaction_count').notNull(),
  categoryCount: integer('category_count').notNull(),
  serviceOrderCount: integer('service_order_count').notNull(),
  data: jsonb('data').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});
