import * as path from "path";
import winston from "winston";
import { paramCase } from "param-case";
import {
  Entity,
  Role,
  AppInfo,
  Module,
  DTOs,
  DSGResourceData,
} from "@amplication/code-gen-types";
import { readStaticModules } from "../read-static-modules";
import { formatCode, formatJson } from "../util/module";
import { createDTOModules } from "./resource/create-dtos";
import { createResourcesModules } from "./resource/create-resource";
import { createSwagger } from "./swagger/create-swagger";
import { createAppModule } from "./app-module/create-app-module";
import { createPrismaSchemaModule } from "./prisma/create-prisma-schema-module";
import { createGrantsModule } from "./create-grants";
import { createDotEnvModule } from "./create-dotenv";
import { createSeedModule } from "./seed/create-seed";
import {
  BASE_DIRECTORY,
  DOCKER_COMPOSE_DB_FILE_NAME,
  DOCKER_COMPOSE_FILE_NAME,
  ENV_VARIABLES,
} from "./constants";
import { createAuthModules } from "./auth/createAuth";
import { createDockerComposeFile } from "./create-docker-compose";
import { createPackageJson } from "./package-json/create-package-json";
import { createMessageBroker } from "./message-broker/create-service-message-broker-modules";
import { fromServiceTopicsToTopicsWithName } from "../util/message-broker";
import { EnumResourceType } from "../models";

const STATIC_DIRECTORY = path.resolve(__dirname, "static");

const validatePath = (serverPath: string) => serverPath.trim() || null;

const dynamicPathCreator = (serverPath: string) => {
  const baseDirectory = validatePath(serverPath) || BASE_DIRECTORY;
  const srcDirectory = `${baseDirectory}/src`;
  return {
    BASE: baseDirectory,
    SRC: srcDirectory,
    SCRIPTS: `${baseDirectory}/scripts`,
    AUTH: `${baseDirectory}/auth`,
  };
};

export async function createServerModules(
  entities: Entity[],
  roles: Role[],
  appInfo: AppInfo,
  dtos: DTOs,
  userEntity: Entity,
  dSGResourceData: DSGResourceData,
  logger: winston.Logger
): Promise<Module[]> {
  const directoryManager = dynamicPathCreator(
    appInfo?.settings?.serverSettings?.serverPath || ""
  );

  const serviceTopicsWithName = fromServiceTopicsToTopicsWithName(
    dSGResourceData.serviceTopics || [],
    dSGResourceData.otherResources?.filter(
      (resource) => resource.resourceType === EnumResourceType.MessageBroker
    ) || []
  );

  logger.info(`Server path: ${directoryManager.BASE}`);
  logger.info("Creating server...");
  logger.info("Copying static modules...");
  const staticModules = await readStaticModules(
    STATIC_DIRECTORY,
    directoryManager.BASE
  );
  const packageJsonModule = await createPackageJson({
    update: {
      name: `@${paramCase(appInfo.name)}/server`,
      version: appInfo.version,
    },
    baseDirectory: directoryManager.BASE,
  });

  logger.info("Creating resources...");
  const dtoModules = createDTOModules(dtos, directoryManager.SRC);
  const resourcesModules = await createResourcesModules(
    appInfo,
    entities,
    dtos,
    logger,
    directoryManager.SRC
  );

  logger.info("Creating Auth module...");
  const authModules = await createAuthModules({ srcDir: directoryManager.SRC });

  logger.info("Creating application module...");
  const appModule = await createAppModule(
    resourcesModules,
    staticModules,
    directoryManager.SRC
  );

  logger.info("Creating swagger...");
  const swaggerModule = await createSwagger(appInfo, directoryManager.SRC);

  logger.info("Creating seed script...");
  const seedModule = await createSeedModule(
    userEntity,
    dtos,
    directoryManager.SCRIPTS,
    directoryManager.SRC
  );
  logger.info("Creating kakfa modules...");
  const kafkaModules = await createMessageBroker({
    srcFolder: directoryManager.SRC,
    serviceTopicsWithName: serviceTopicsWithName,
  });

  const createdModules = [
    ...resourcesModules,
    ...dtoModules,
    swaggerModule,
    appModule,
    seedModule,
    ...authModules,
    ...kafkaModules,
  ];

  logger.info("Formatting code...");
  const formattedModules = createdModules.map((module) => ({
    ...module,
    code: formatCode(module.code),
  }));
  const formattedJsonFiles = [...packageJsonModule].map((module) => ({
    ...module,
    code: formatJson(module.code),
  }));

  logger.info("Creating Prisma schema...");
  const prismaSchemaModule = await createPrismaSchemaModule(
    entities,
    directoryManager.BASE
  );

  logger.info("Creating access control grants...");
  const grantsModule = createGrantsModule(
    entities,
    roles,
    directoryManager.SRC
  );
  const dotEnvModule = await createDotEnvModule({
    baseDirectory: directoryManager.BASE,
    envVariables: ENV_VARIABLES,
  });

  const dockerComposeFile = await createDockerComposeFile(
    directoryManager.BASE,
    DOCKER_COMPOSE_FILE_NAME
  );

  const dockerComposeDbFile = await createDockerComposeFile(
    directoryManager.BASE,
    DOCKER_COMPOSE_DB_FILE_NAME
  );

  return [
    ...staticModules,
    ...formattedJsonFiles,
    ...formattedModules,
    prismaSchemaModule,
    grantsModule,
    ...dotEnvModule,
    dockerComposeFile,
    dockerComposeDbFile,
  ];
}
