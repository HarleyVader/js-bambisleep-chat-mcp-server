const request = require('supertest');
const { app } = require('../src/app');

describe('Server Health Check', () => {
    test('GET /health should return 200', async () => {
        const response = await request(app)
            .get('/health')
            .expect(200);

        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('version');
    });

    test('GET / should return server info', async () => {
        const response = await request(app)
            .get('/')
            .expect(200);

        expect(response.body).toHaveProperty('name');
        expect(response.body).toHaveProperty('version');
        expect(response.body).toHaveProperty('endpoints');
    });

    test('GET /nonexistent should return 404', async () => {
        const response = await request(app)
            .get('/nonexistent')
            .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('message', 'Not Found');
    });
});
