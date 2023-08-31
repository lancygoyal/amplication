/* eslint-disable */
export default {
  displayName: "amplication-git-sync-manager",
  preset: "../../../jest.preset.js",
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.spec.json",
    },
  },
  transform: {
    "^.+\\.[tj]s$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory:
    "../../../coverage/ee/packages/amplication-git-sync-manager",
  coverageThreshold: {
    global: {
      branches: 48,
      lines: 25,
    },
  },
};
