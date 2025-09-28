import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UsersService {
    private usersRepository;
    constructor(usersRepository: Repository<User>);
    findOne(id: number): Promise<User>;
    deleteById(id: number): Promise<void>;
}
