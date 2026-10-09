import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts', 'supabase/**', 'scripts/**'],
  },
  {
    // Kept as warnings so lint can gate builds today; tighten as the code is typed.
    // set-state-in-effect flags intentional patterns here (resetting forms when a
    // modal opens, reading localStorage after mount).
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
