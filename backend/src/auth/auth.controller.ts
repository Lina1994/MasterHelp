import { Body, Controller, Post, Put, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  // Endpoint para restablecer la contraseña usando el token
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }

  // Endpoint para cambiar la contraseña del usuario autenticado actualmente
  @Put('change-password')
  @ApiBearerAuth() // Indica que requiere token
  @UseGuards(JwtAuthGuard) // Protege la ruta usando el guardia JwtAuthGuard
  async changePassword(@Request() req, @Body() changePasswordDto: { currentPassword: string; newPassword: string }) {
    // req.user es inyectado por el guardia JwtAuthGuard
    return this.authService.changePassword(req.user.userId, changePasswordDto.currentPassword, changePasswordDto.newPassword);
  }
}