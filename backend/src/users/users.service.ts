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
}