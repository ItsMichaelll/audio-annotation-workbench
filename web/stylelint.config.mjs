export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // CSS Modules expose camelCase keys to TypeScript. Renaming them would
    // create a second component migration rather than enforce CSS quality.
    'selector-class-pattern': null,

    // Prettier owns formatting. Preserve the established, valid notation
    // where Stylelint's preferred spelling would only create visual churn.
    'alpha-value-notation': null,
    'color-function-alias-notation': null,
    'color-function-notation': null,
    'custom-property-empty-line-before': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'declaration-empty-line-before': null,
    'font-family-name-quotes': null,
    'import-notation': null,
    'media-feature-range-notation': null,
    'no-descending-specificity': null,
    'value-keyword-case': null,

    'declaration-no-important': true,
    'selector-max-compound-selectors': [3, { severity: 'warning' }],
    'selector-max-specificity': ['0,3,1', { severity: 'warning' }],
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['global'] },
    ],
  },
  overrides: [
    {
      files: ['src/styles/utilities.css'],
      rules: {
        // The clipping fallback remains part of the proven visually-hidden
        // accessibility utility alongside the modern clip-path declaration.
        'property-no-deprecated': null,
      },
    },
  ],
}
