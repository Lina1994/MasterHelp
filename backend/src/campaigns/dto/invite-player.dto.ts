import { IsNotEmpty, IsString, IsEmail, ValidateIf, MaxLength } from 'class-validator';

/**
 * DTO para invitar a un jugador a una campaña.
 * El identificador de la campaña se obtiene del parámetro de ruta (:id), por lo que
 * no debe enviarse en el cuerpo. Se exige que al menos uno de los campos
 * 'email' o 'username' sea provisto.
 * Sprint 2: Added length validation for email and username.
 */
export class InvitePlayerDto {
  /** Email del usuario a invitar (si no se proporciona username). */
  @ValidateIf((o) => !o.username)
  @IsNotEmpty({ message: 'email is required when username is not provided' })
  @IsEmail({}, { message: 'email must be a valid email' })
  @MaxLength(255, { message: 'email must not exceed 255 characters' })
  email?: string;

  /** Username del usuario a invitar (si no se proporciona email). */
  @ValidateIf((o) => !o.email)
  @IsNotEmpty({ message: 'username is required when email is not provided' })
  @IsString({ message: 'username must be a string' })
  @MaxLength(50, { message: 'username must not exceed 50 characters' })
  username?: string;
}
