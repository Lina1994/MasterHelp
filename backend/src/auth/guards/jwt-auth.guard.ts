import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {} // Extiende AuthGuard usando la estrategia 'jwt' definida en jwt.strategy.ts
