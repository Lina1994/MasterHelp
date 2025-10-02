import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'defaultSecret', // Usar variable de entorno
    });
  }

  /**
   * Valida el payload del JWT y expone los campos necesarios en la request.
   * @param payload Objeto decodificado del token JWT.
   * @returns Objeto con userId y username para inyectar en req.user
   */
  async validate(payload: JwtPayload): Promise<ValidatedUserPayload> {
    return { userId: payload.sub, username: payload.username };
  }
}

/**
 * Interface que representa el payload mínimo esperado dentro del JWT.
 */
interface JwtPayload {
  sub: number | string;
  username: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown; // Permitir claims adicionales sin perder tipado
}

/**
 * Objeto que se adjunta a req.user tras la validación del token.
 */
interface ValidatedUserPayload {
  userId: number | string;
  username: string;
}
