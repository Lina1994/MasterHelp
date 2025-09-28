import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity'; // Asegúrate de importar la entidad
import { UsersService } from '../users/users.service'; // Asegúrate de importar el servicio
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // Importa la entidad User aquí
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultSecret', // Usar variable de entorno
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, JwtStrategy], // Asegúrate de incluir UsersService si lo usas en AuthService
  exports: [AuthService],
})
export class AuthModule {}