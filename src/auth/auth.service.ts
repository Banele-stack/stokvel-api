import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; name: string; phone: string | null };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  private sign(user: User): string {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersRepo.save(
      this.usersRepo.create({
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        phone: dto.phone ?? null,
      }),
    );

    return {
      accessToken: this.sign(user),
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersRepo.findOne({ where: { email: dto.email.toLowerCase() } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return {
      accessToken: this.sign(user),
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    };
  }

  async me(userId: string): Promise<AuthResult['user']> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, email: user.email, name: user.name, phone: user.phone };
  }
}
