import { Injectable, NotFoundException } from '@nestjs/common'; // 1. Importar NotFoundException
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOne(id: number): Promise<User> {
    // 2. Buscar el usuario
    const user = await this.usersRepository.findOneBy({ id });

    // 3. Comprobar si existe y lanzar excepción si no
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // 4. Devolver el usuario si se encuentra
    return user;
  }

  async deleteById(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
  }

  /**
  * Updates user preferences (language, theme, sidebarConfig, shortcutsConfig).
   *
   * @param id - User ID.
   * @param language - Optional new UI language.
   * @param theme - Optional new UI theme.
   * @param sidebarConfig - Optional sidebar configuration (JSON string or null to reset).
   * @param shortcutsConfig - Optional shortcuts shell configuration.
   * @returns The updated user.
   */
  async updatePreferences(
    id: number,
    language?: string,
    theme?: string,
    sidebarConfig?: string | null,
    shortcutsConfig?: string | null,
  ): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) throw new NotFoundException(`User with ID "${id}" not found`);
    if (language) user.language = language;
    if (theme) user.theme = theme;
    if (sidebarConfig !== undefined) user.sidebarConfig = sidebarConfig;
    if (shortcutsConfig !== undefined) user.shortcutsConfig = shortcutsConfig;
    await this.usersRepository.save(user);
    return user;
  }
}
