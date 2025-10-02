import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Resend } from 'resend';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
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
      if (error.code === '23505') {
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

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      console.warn(`Password reset requested for non-existent email: ${email}`);
      return { message: 'If a user with that email exists, a password reset link has been sent.' };
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
      { expiresIn: '1h' },
    );

    const resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: user.email,
        subject: 'Restablece tu contraseña',
        html: `
          <h1>Hola, ${user.username}</h1>
          <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
          <p>Haz clic en el siguiente enlace para continuar:</p>
          <a href="${resetLink}" target="_blank">Restablecer Contraseña</a>
          <p>Si no solicitaste esto, puedes ignorar este correo.</p>
        `,
      });
      console.log(`Password reset email sent to: ${email}`);
    } catch (error) {
      console.error(`Failed to send password reset email to ${email}`, error);
      // No lanzamos un error al cliente para no revelar si el email existe
    }

    return { message: 'If a user with that email exists, a password reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      const decoded = this.jwtService.verify(token);
      const user = await this.usersRepository.findOne({ where: { id: decoded.sub } });

      if (!user || user.email !== decoded.email) {
        throw new UnauthorizedException('Invalid or expired token.');
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedNewPassword;
      await this.usersRepository.save(user);

      return { message: 'Password has been reset successfully.' };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await this.usersRepository.save(user);

    return { message: 'Password has been changed successfully' };
  }
}
