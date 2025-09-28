import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { username, email, password } = registerDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User();
    user.username = username;
    user.email = email;
    user.password = hashedPassword;

    try {
      await this.usersRepository.save(user);
      return { message: 'User registered successfully' };
    } catch (error) {
      if (error.code === '23505') { // Código de error para violación de unicidad en PostgreSQL
        throw new UnauthorizedException('Username or email already exists');
      }
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    const { username, password } = loginDto;
    const user = await this.usersRepository.findOne({ where: { username } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { username: user.username, sub: user.id };
    const access_token = this.jwtService.sign(payload);
    return { access_token };
  }

  // Simular el envío de correo de recuperación
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      // Para evitar abusos, no revelamos si el email existe o no
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    // Generar un token de recuperación (esto es un ejemplo, en producción usarías algo más seguro y persistente)
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '1h' } // Token válido por 1 hora
    );

    // Simular envío de correo
    console.log(`Forgot password requested for: ${email}`);
    console.log(`Reset token (simulated email): ${resetToken}`);
    // Aquí iría la lógica real de envío de email usando un servicio como nodemailer, SendGrid, etc.
    // El enlace enviado contendría el token: http://yourapp.com/reset-password?token=${resetToken}

    return { message: 'If the email exists, a reset link has been sent.' };
  }

  // Restablecer contraseña usando el token
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.usersRepository.findOne({ where: { id: decoded.sub } });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Verificar que el email en el token coincida con el del usuario (opcional, por seguridad)
      if (user.email !== decoded.email) {
         throw new UnauthorizedException('Invalid token');
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedNewPassword;
      await this.usersRepository.save(user);

      return { message: 'Password has been reset successfully' };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      throw new UnauthorizedException('Invalid token');
    }
  }

  // Cambiar contraseña para el usuario autenticado
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verificar la contraseña actual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash de la nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await this.usersRepository.save(user);

    return { message: 'Password has been changed successfully' };
  }
}