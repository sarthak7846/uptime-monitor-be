import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './login.dto';
import { SignupDto } from './signup.dto';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async login(loginDto: LoginDto) {
    try {
      const user = await this.prismaService.user.findUnique({
        where: {
          email: loginDto.email,
        },
      });

      if (user) {
        const isPasswordValid = bcrypt.compare(loginDto.password, user.password);

        if (!isPasswordValid) {
          throw new UnauthorizedException('Invalid credentials');
        }

        const tokens = await this.generateJwtTokens(user);
        return {
          status: 'success',
          access_token: tokens.accessToken,
        };
      }
      throw new NotFoundException('User not found');
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async signup(signupDto: SignupDto) {
    const { email, name, password } = signupDto;

    try {
      const user = await this.prismaService.user.findUnique({
        where: {
          email,
        },
      });

      if (user) {
        throw new BadRequestException('User already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await this.userService.createUser({
        email,
        name,
        password: hashedPassword,
      });

      return {
        status: 'success',
        data: newUser,
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private async generateJwtTokens(user: User) {
    const payload: any = {
      sub: user.id,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '30d' });
    return { accessToken };
  }
}
