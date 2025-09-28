"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.typeOrmConfig = void 0;
const user_entity_1 = require("../users/entities/user.entity");
const path_1 = require("path");
const databasePath = (0, path_1.join)(__dirname, '..', '..', 'data', 'dm_app.db');
const fs_1 = require("fs");
const path_2 = require("path");
const ensureDirectoryExists = async (filePath) => {
    const dir = (0, path_2.dirname)(filePath);
    try {
        await fs_1.promises.access(dir);
    }
    catch {
        await fs_1.promises.mkdir(dir, { recursive: true });
    }
};
ensureDirectoryExists(databasePath).catch(console.error);
exports.typeOrmConfig = {
    type: 'sqlite',
    database: databasePath,
    entities: [user_entity_1.User],
    synchronize: true,
    logging: false,
};
//# sourceMappingURL=typeorm.config.js.map