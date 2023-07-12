const { setupDb } = require('./utils');
const request = require('supertest');
const app = require('../lib/app');
const UserService = require('../lib/services/UserService');

// Dummy user for testing
const mockUser = {
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  password: '12345',
};

const registerAndLogin = async (userProps = {}) => {
  const password = userProps.password ?? mockUser.password;

  // Create an "agent" that gives us the ability
  // to store cookies between requests in a test
  const agent = request.agent(app);

  // Create a user to sign in with
  const user = await UserService.create({ ...mockUser, ...userProps });

  // ...then sign in
  const { email } = user;
  await agent.post('/api/v1/users/sessions').send({ email, password });
  return [agent, user];
};

describe('user routes', () => {
  beforeEach(setupDb);

  it('creates a new user', async () => {
    const res = await request(app).post('/api/v1/users').send(mockUser);
    const { username, firstName, lastName, email } = mockUser;

    expect(res.body).toEqual({
      id: expect.any(String),
      email,
      username,
      firstName,
      lastName,
    });
  });

  it('signs in an existing user', async () => {
    await request(app).post('/api/v1/users').send(mockUser);
    const { email, password } = mockUser;
    const res = await request(app)
      .post('/api/v1/users/sessions')
      .send({ email, password });
    expect(res.status).toEqual(200);
  });

  it('/me should return a 401 if not authenticated', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toEqual(401);
  });

  it('/me should return user/token if authenticated', async () => {
    const [agent, user] = await registerAndLogin();
    const res = await agent.get('/api/v1/users/me');
    expect(res.status).toEqual(200);
    expect(res.body).toEqual(expect.objectContaining(user));
  });

  it('/users should return 403 if user not admin', async () => {
    const [agent] = await registerAndLogin();
    const res = await agent.get('/api/v1/users/');
    expect(res.status).toEqual(403);
  });

  it('/users should return 200 if user is admin', async () => {
    const agent = request.agent(app);

    // create a new user
    await agent.post('/api/v1/users').send({
      email: 'admin',
      password: '1234',
      firstName: 'admin',
      lastName: 'admin',
    });
    // sign in the user
    await agent
      .post('/api/v1/users/sessions')
      .send({ email: 'admin', password: '1234' });

    // const [agent] = await registerAndLogin({ email: 'admin' });
    const res = await agent.get('/api/v1/users/');
    expect(res.status).toEqual(200);
  });

  it('/users should return a 200 if user is admin', async () => {
    const [agent] = await registerAndLogin({ email: 'admin' });
    const res = await agent.get('/api/v1/users/');
    expect(res.status).toEqual(200);
  });

  it('DELETE /sessions deletes the user session', async () => {
    const [agent] = await registerAndLogin();
    const resp = await agent.delete('/api/v1/users/sessions');
    expect(resp.status).toBe(204);
  });
});
