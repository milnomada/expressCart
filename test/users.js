import { serial as test } from 'ava';
const {
    runBefore,
    g
} = require('../lib/helper');

test.before(async () => {
    await runBefore();
});

test('[Success] Create API key', async t => {
    // Login
    await g.request
        .post('/admin/login')
        .send({
            email: g.users[0].userEmail,
            password: 'test'
        });
    const res = await g.request
        .post('/admin/createApiKey')
        .expect(200);

    g.users[0].apiKey = res.body.apiKey;
    t.deepEqual(res.body.message, 'API Key generated');
    t.deepEqual(res.body.apiKey.length, 24);
});

test('[Success] User Login', async t => {
    const res = await g.request
        .post('/admin/login')
        .send({
            email: g.users[0].userEmail,
            password: 'test'
        })
        .expect(200);
    t.deepEqual(res.body.message, 'Login successful');
});

test('[Fail] Incorrect user password', async t => {
    const res = await g.request
        .post('/admin/login')
        .send({
            email: g.users[0].userEmail,
            password: 'test1'
        })
        .expect(400);
    t.deepEqual(res.body.message, 'Access denied. Check password and try again.');
});

test('[Fail] Delete own user account', async t => {
    const res = await g.request
        .get(`/admin/user/delete/${g.users[0]._id}`)
        .expect(302);
    t.deepEqual(res.header['location'], '/admin/users');
});

test('[Fail] Delete invalid user ID', async t => {
    const res = await g.request
        .get('/admin/user/delete/invalid_user_id')
        .expect(302);
    t.deepEqual(res.header['location'], '/admin/users');
});
