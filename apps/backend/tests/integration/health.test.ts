import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';

describe('Integration : Health & Routing Global (SPEC 2 & 9)', () => {
  it('GET /api/health répond 200 avec le fuseau horaire de Kinshasa', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timezone).toBe('Africa/Kinshasa');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/unknwown-endpoint répond 404 avec message d\'erreur standard', async () => {
    const res = await request(app).get('/api/route-inexistante');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Endpoint non trouvé');
  });
});
