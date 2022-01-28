import * as dotenv from "dotenv";

export const loadEnv = (env_path: string) => {
  // Load .env into dictionary for lambda function
  console.log(env_path);
  try {
    const env = dotenv.config({
      path: env_path,
    });
    if (env.error) {
      throw env.error;
    }
    const env_values = {
      ...env.parsed,
    };
    return env_values;
  } catch (e) {
    console.log(e);
    return {};
  }
};
