import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getMe(req: any): Promise<import("./entities/user.entity").User>;
    findOne(id: number): Promise<import("./entities/user.entity").User>;
    deleteMe(req: any): Promise<void>;
}
