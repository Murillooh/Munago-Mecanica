import { describe, it, expect } from 'vitest';
import { poolConfig } from './client';

describe('poolConfig', () => {
  it('remove sslmode da URL e verifica certificado com a CA da AWS', () => {
    const cfg = poolConfig('postgres://u:p@host.rds.amazonaws.com:5432/db?sslmode=require');
    expect(cfg.connectionString).not.toContain('sslmode');
    expect(cfg.ssl).toMatchObject({ rejectUnauthorized: true });
    expect((cfg.ssl as { ca: string }).ca).toContain('BEGIN CERTIFICATE');
  });

  it('sem sslmode não usa SSL (banco local)', () => {
    expect(poolConfig('postgres://u:p@localhost:5432/db').ssl).toBeUndefined();
  });
});
