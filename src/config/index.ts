export { default as schema } from './schema';

import test from './test';
import development from './development';
import production from './production';

export const configurations = {
  test,
  development,
  production,
};
