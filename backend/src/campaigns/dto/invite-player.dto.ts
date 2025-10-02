import { IsNotEmpty, IsString, IsEmail, ValidateIf } from 'class-validator';

/**
 * DTO para invitar a un jugador a una campaña.
 * El identificador de la campaña se obtiene del parámetro de ruta (:id), por lo que
 * no debe enviarse en el cuerpo. Se exige que al menos uno de los campos
 * 'email' o 'username' sea provisto.
 */
export class InvitePlayerDto {
  /** Email del usuario a invitar (si no se proporciona username). */
  @ValidateIf((o) => !o.username)
  @IsNotEmpty({ message: 'email is required when username is not provided' })
  @IsEmail({}, { message: 'email must be a valid email' })
  email?: string;

  /** Username del usuario a invitar (si no se proporciona email). */
  @ValidateIf((o) => !o.email)
  @IsNotEmpty({ message: 'username is required when email is not provided' })
  @IsString({ message: 'username must be a string' })
  username?: string;
}
