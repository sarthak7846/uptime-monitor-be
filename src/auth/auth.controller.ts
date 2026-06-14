import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './login.dto';
import { SignupDto } from './signup.dto';
import { Public } from './public.decorator';
import type { Response } from 'express';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const res = await this.authService.login(loginDto);
    const token = res.access_token;
    response.cookie('token', token, {
      httpOnly: true,
      sameSite: 'none',
      secure: false,
    });
    return res;
  }

  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    const res = await this.authService.signup(signupDto);
    return res;
  }
}
