-- Tempo real por oficina: o aviso vira "recurso:oficina" e o servidor só entrega aos usuários dela.
-- TG_ARGV[1] = coluna com o id da oficina; sem ela o escopo é '*' (só o admin geral).
-- Trigger por linha, mas o pg_notify descarta payloads iguais na mesma transação: um INSERT de 100
-- produtos da mesma oficina continua gerando um aviso só.
CREATE OR REPLACE FUNCTION notify_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  col text := TG_ARGV[1];
  old_scope text;
  new_scope text;
BEGIN
  IF col IS NULL THEN
    PERFORM pg_notify('mecanica_changes', TG_ARGV[0] || ':*');
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    old_scope := to_jsonb(OLD) ->> col;
    PERFORM pg_notify('mecanica_changes', TG_ARGV[0] || ':' || old_scope);
  END IF;
  -- Linha que muda de oficina (usuário transferido) avisa as duas.
  IF TG_OP <> 'DELETE' THEN
    new_scope := to_jsonb(NEW) ->> col;
    IF new_scope IS DISTINCT FROM old_scope THEN
      PERFORM pg_notify('mecanica_changes', TG_ARGV[0] || ':' || new_scope);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
DROP TRIGGER products_notify_change ON products;--> statement-breakpoint
CREATE TRIGGER products_notify_change AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION notify_change('products', 'workspace_id');--> statement-breakpoint
DROP TRIGGER categories_notify_change ON categories;--> statement-breakpoint
CREATE TRIGGER categories_notify_change AFTER INSERT OR UPDATE OR DELETE ON categories FOR EACH ROW EXECUTE FUNCTION notify_change('categories', 'workspace_id');--> statement-breakpoint
DROP TRIGGER transactions_notify_change ON transactions;--> statement-breakpoint
CREATE TRIGGER transactions_notify_change AFTER INSERT OR UPDATE OR DELETE ON transactions FOR EACH ROW EXECUTE FUNCTION notify_change('transactions', 'workspace_id');--> statement-breakpoint
DROP TRIGGER service_orders_notify_change ON service_orders;--> statement-breakpoint
CREATE TRIGGER service_orders_notify_change AFTER INSERT OR UPDATE OR DELETE ON service_orders FOR EACH ROW EXECUTE FUNCTION notify_change('serviceOrders', 'workspace_id');--> statement-breakpoint
DROP TRIGGER notifications_notify_change ON notifications;--> statement-breakpoint
CREATE TRIGGER notifications_notify_change AFTER INSERT OR UPDATE OR DELETE ON notifications FOR EACH ROW EXECUTE FUNCTION notify_change('notifications', 'workspace_id');--> statement-breakpoint
DROP TRIGGER users_notify_change ON users;--> statement-breakpoint
CREATE TRIGGER users_notify_change AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION notify_change('users', 'workspace_id');--> statement-breakpoint
DROP TRIGGER settings_notify_change ON settings;--> statement-breakpoint
CREATE TRIGGER settings_notify_change AFTER INSERT OR UPDATE OR DELETE ON settings FOR EACH ROW EXECUTE FUNCTION notify_change('settings', 'id');--> statement-breakpoint
DROP TRIGGER workspaces_notify_change ON workspaces;--> statement-breakpoint
CREATE TRIGGER workspaces_notify_change AFTER INSERT OR UPDATE OR DELETE ON workspaces FOR EACH ROW EXECUTE FUNCTION notify_change('workspaces', 'id');--> statement-breakpoint
DROP TRIGGER services_notify_change ON services;--> statement-breakpoint
CREATE TRIGGER services_notify_change AFTER INSERT OR UPDATE OR DELETE ON services FOR EACH ROW EXECUTE FUNCTION notify_change('services', 'workspace_id');
