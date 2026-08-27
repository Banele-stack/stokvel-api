import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

type MockRepo<T> = { [K in keyof T]?: jest.Mock } & Record<string, jest.Mock>;

function mockRepo(): MockRepo<any> {
  return {
    findOne: jest.fn(),
    save: jest.fn((entity) => Promise.resolve({ id: 'generated-id', ...entity })),
    create: jest.fn((entity) => entity),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: MockRepo<User>;

  beforeEach(async () => {
    usersRepo = mockRepo();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('signed.jwt.token') } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('creates a new user with a hashed password, never the plaintext', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.register({
        name: 'Thabo Mokoena',
        email: 'Thabo@Example.com',
        password: 'Passw0rd1',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      const saved = usersRepo.save.mock.calls[0][0];
      expect(saved.email).toBe('thabo@example.com');
      expect(saved.passwordHash).not.toBe('Passw0rd1');
      expect(await bcrypt.compare('Passw0rd1', saved.passwordHash)).toBe(true);
    });

    it('rejects registration with an email that already exists', async () => {
      usersRepo.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({ name: 'Thabo Mokoena', email: 'thabo@example.com', password: 'Passw0rd1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('rejects an unknown email without revealing whether the account exists', async () => {
      usersRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'nobody@example.com', password: 'x' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      usersRepo.findOne.mockResolvedValue({ id: 'u1', email: 'thabo@example.com', passwordHash });

      await expect(
        service.login({ email: 'thabo@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('succeeds with the correct password and returns a token', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 12);
      usersRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'thabo@example.com',
        name: 'Thabo Mokoena',
        phone: null,
        passwordHash,
      });

      const result = await service.login({ email: 'thabo@example.com', password: 'correct-password' });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.email).toBe('thabo@example.com');
    });
  });
});
