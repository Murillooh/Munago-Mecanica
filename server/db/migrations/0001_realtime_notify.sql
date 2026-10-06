-- Tempo real: toda escrita (API, script, console, outra instância) avisa o servidor via LISTEN/NOTIFY.
-- Trigger por comando (FOR EACH STATEMENT): um INSERT de 100 linhas gera um aviso só.
-- O payload é o nome do recurso que o frontend conhece (ver server/realtime/events.ts).
CREATE OR REPLACE FUNCTION notify_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('mecanica_changes', TG_ARGV[0]);
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER products_notify_change AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH STATEMENT EXECUTE FUNCTION notify_change('products');
--> statement-breakpoint
CREATE TRIGGER categories_notify_change AFTER INSERT OR UPDATE OR DELETE ON categories FOR EACH STATEMENT EXECUTE FUNCTION notify_change('categories');
--> statement-breakpoint
CREATE TRIGGER transactions_notify_change AFTER INSERT OR UPDATE OR DELETE ON transactions FOR EACH STATEMENT EXECUTE FUNCTION notify_change('transactions');
--> statement-breakpoint
CREATE TRIGGER service_orders_notify_change AFTER INSERT OR UPDATE OR DELETE ON service_orders FOR EACH STATEMENT EXECUTE FUNCTION notify_change('serviceOrders');
--> statement-breakpoint
CREATE TRIGGER notifications_notify_change AFTER INSERT OR UPDATE OR DELETE ON notifications FOR EACH STATEMENT EXECUTE FUNCTION notify_change('notifications');
--> statement-breakpoint
CREATE TRIGGER users_notify_change AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH STATEMENT EXECUTE FUNCTION notify_change('users');
--> statement-breakpoint
CREATE TRIGGER settings_notify_change AFTER INSERT OR UPDATE OR DELETE ON settings FOR EACH STATEMENT EXECUTE FUNCTION notify_change('settings');
--> statement-breakpoint
CREATE TRIGGER access_requests_notify_change AFTER INSERT OR UPDATE OR DELETE ON access_requests FOR EACH STATEMENT EXECUTE FUNCTION notify_change('accessRequests');
