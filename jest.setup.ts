import '@testing-library/react-native/dist/matchers/extend-expect';
import { cleanup } from '@testing-library/react-native/pure';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.useReducedMotion = () => false;
  return Reanimated;
});
jest.mock('uniwind', () => {
  const actual = jest.requireActual('uniwind');
  const values: Record<string, string> = {
    '--theme': 'default',
    '--background': '#ffffff',
    '--foreground': '#1b1b1b',
    '--surface': '#ffffff',
    '--surface-foreground': '#1b1b1b',
    '--muted': '#6b7280',
    '--default': '#f4f4f5',
    '--default-foreground': '#1b1b1b',
    '--accent': '#0a7ea4',
    '--accent-foreground': '#ffffff',
    '--success': '#16803c',
    '--warning': '#9a6700',
    '--danger': '#d1453b',
    '--border': '#e4e4e7',
  };
  const resolve = (name: string) => values[name] ?? '#1b1b1b';
  return {
    ...actual,
    useCSSVariable: (name: string | string[]) => Array.isArray(name)
      ? name.map(resolve)
      : resolve(name),
  };
});

afterEach(cleanup);
